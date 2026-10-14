import { auth } from '@/lib/firebase';
import { getCachedSessionRole } from '@/services/session';
import { invalidate, invalidateLists } from '@/lib/query-client';
import {
  ensureContentVersionsFresh,
  hasContentVersionGap,
  registerContentVersion,
  type ContentVersionDomain,
} from '@/services/content-versions';
import {
  startRealtimeSession,
  stopRealtimeSession,
  subscribeRealtimeTopic,
} from '@/services/realtime-transport';
import type { ContentChange } from '@shared/contracts/realtime.ts';

interface RealtimeSubscriber {
  callback: (event: ContentRealtimeEvent) => void;
  onResync?: () => void;
}

const realtimeSubscribers = new Map<number, RealtimeSubscriber>();
let realtimeSubscriberSerial = 0;
let realtimeSessionActive = false;
let contentSubscriptionKey = '';
let contentUnsubscribers: Array<() => void> = [];

type ContentRealtimeEvent = ContentChange;

function realtimeEventDomain(event: ContentRealtimeEvent): ContentVersionDomain {
  if (event.eventType.startsWith('issue_')) return 'issues';
  if (event.eventType === 'facility_changed') return 'facilities';
  return 'announcements';
}

function synchronizeRealtimeVersion(event: ContentRealtimeEvent) {
  if (event.domainRevision <= 0) return;
  const domain = realtimeEventDomain(event);
  if (hasContentVersionGap(domain, event.domainRevision)) {
    void ensureContentVersionsFresh().catch(() => undefined);
    return;
  }
  registerContentVersion(domain, event.domainRevision);
}

/** What a change makes stale: the domain's lists, the record, and its discussion if that is what changed. */
function invalidateRealtimeContent(event: ContentRealtimeEvent) {
  if (event.eventType === 'facility_changed') {
    void invalidateLists('facilities');
    void invalidate(['facilities', 'detail', event.targetId]);
    return;
  }
  const domain = event.eventType.startsWith('issue_') ? 'issues' : 'announcements';
  const commentChanged = event.eventType === 'issue_comment_changed' || event.eventType === 'announcement_comment_changed';
  const recordId = commentChanged ? event.parentId : event.targetId;
  void invalidateLists(domain);
  if (!recordId) return;
  void invalidate([domain, 'detail', recordId]);
  if (commentChanged) void invalidate([domain, 'comments', recordId]);
}

function receiveContentEvent(event: ContentRealtimeEvent) {
  invalidateRealtimeContent(event);
  synchronizeRealtimeVersion(event);
  realtimeSubscribers.forEach((subscriber) => subscriber.callback(event));
}

function disconnectContentTopics() {
  contentUnsubscribers.forEach((unsubscribe) => unsubscribe());
  contentUnsubscribers = [];
  contentSubscriptionKey = '';
}

function ensureContentTopics() {
  const uid = auth?.currentUser?.uid;
  if (!uid || (!realtimeSessionActive && realtimeSubscribers.size === 0)) return;
  const topics = [
    'content:school',
    getCachedSessionRole() === 'admin' ? 'content:admin' : `content:user:${uid}`,
  ];
  const key = topics.join('|');
  if (contentSubscriptionKey === key && contentUnsubscribers.length > 0) return;
  disconnectContentTopics();
  const onResync = () => {
    void ensureContentVersionsFresh();
    realtimeSubscribers.forEach((subscriber) => subscriber.onResync?.());
  };
  contentUnsubscribers = topics.map((topic) => subscribeRealtimeTopic(
    topic,
    'content_changed',
    receiveContentEvent,
    { onResync },
  ));
  contentSubscriptionKey = key;
}

/** The topics follow the role: a role change moves the subscription to the topics it now allows. */
export function refreshContentRealtimeTopics() {
  ensureContentTopics();
}

export function startContentRealtimeSession() {
  realtimeSessionActive = true;
  startRealtimeSession();
  ensureContentTopics();
}

export function stopContentRealtimeSession() {
  realtimeSessionActive = false;
  disconnectContentTopics();
  stopRealtimeSession();
}

export function subscribeContentRealtimeEvents(
  channelScope: string,
  callback: (event: ContentRealtimeEvent) => void,
  onResync?: () => void,
) {
  void channelScope;
  const subscriberId = realtimeSubscriberSerial += 1;
  realtimeSubscribers.set(subscriberId, { callback, onResync });
  ensureContentTopics();
  return () => {
    realtimeSubscribers.delete(subscriberId);
    if (!realtimeSessionActive && realtimeSubscribers.size === 0) disconnectContentTopics();
  };
}
