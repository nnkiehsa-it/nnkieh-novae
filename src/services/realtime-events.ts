import { auth } from '@/lib/firebase';
import { getCachedSessionRole } from '@/services/session-role';
import { markContentCachePrefixStale } from '@/services/content-read-cache';
import {
  ensureContentVersionsFresh,
  hasContentVersionGap,
  registerContentVersion,
  type ContentVersionDomain,
} from '@/services/content-versions';
import { patchContentEntity } from '@/lib/content-entity-store';
import {
  startRealtimeSession,
  stopRealtimeSession,
  subscribeRealtimeTopic,
} from '@/services/realtime-transport';
import type { ContentChange } from '@shared/contracts/realtime.ts';
import type { AnnouncementRecord, IssueRecord } from '@/types';

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
    void ensureContentVersionsFresh({ notify: true }).catch(() => undefined);
    return;
  }
  registerContentVersion(domain, event.domainRevision);
}

function invalidateRealtimeContent(event: ContentRealtimeEvent) {
  const scope = auth?.currentUser?.uid;
  if (event.eventType.startsWith('issue_')) {
    const issueId = event.eventType === 'issue_comment_changed' ? event.parentId : event.targetId;
    markContentCachePrefixStale('issue-list-page|');
    markContentCachePrefixStale('issue-search|');
    markContentCachePrefixStale('user-issue-list-page|');
    if (issueId) markContentCachePrefixStale(`issue-detail|${issueId}|`);
    if (event.eventType === 'issue_comment_changed' && issueId) {
      markContentCachePrefixStale(`issue-comments-page|${issueId}|`);
    }
    if (event.eventType === 'issue_support_changed' && event.supportCount !== null) {
      patchContentEntity<IssueRecord>(scope, 'issue', event.targetId, {
        supportCount: event.supportCount,
      }, { serverRevision: event.aggregateRevision });
    }
    return;
  }
  if (event.eventType === 'facility_changed') {
    markContentCachePrefixStale('facility-list-page|');
    markContentCachePrefixStale(`facility-detail|${event.targetId}`);
    return;
  }
  const announcementId = event.eventType === 'announcement_comment_changed'
    ? event.parentId
    : event.targetId;
  markContentCachePrefixStale('announcement-list-page|');
  if (announcementId) markContentCachePrefixStale(`announcement-detail|${announcementId}|`);
  if (event.eventType === 'announcement_comment_changed' && announcementId) {
    markContentCachePrefixStale(`announcement-comments-page|${announcementId}|`);
  }
  if (announcementId) {
    const patch: Partial<AnnouncementRecord> = {};
    if (event.likeCount !== null) patch.likeCount = event.likeCount;
    if (event.commentCount !== null) patch.commentCount = event.commentCount;
    if (Object.keys(patch).length > 0) {
      patchContentEntity<AnnouncementRecord>(scope, 'announcement', announcementId, patch, {
        serverRevision: event.aggregateRevision,
      });
    }
  }
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
    void ensureContentVersionsFresh({ notify: true });
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
