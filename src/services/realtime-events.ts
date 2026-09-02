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
import type { AnnouncementRecord, IssueRecord } from '@/types';

interface RealtimeSubscriber {
  callback: (event: ContentRealtimeEvent) => void;
}

const realtimeSubscribers = new Map<number, RealtimeSubscriber>();
let realtimeSubscriberSerial = 0;
let realtimeSessionActive = false;
let contentSubscriptionKey = '';
let contentUnsubscribers: Array<() => void> = [];

export type ContentRealtimeEventType =
  | 'issue_changed'
  | 'issue_support_changed'
  | 'issue_comment_changed'
  | 'announcement_changed'
  | 'announcement_metrics_changed'
  | 'announcement_comment_changed'
  | 'facility_changed';

export interface ContentRealtimeEvent {
  aggregateRevision: number;
  category: string | null;
  commentCount: number | null;
  createdAt: Date | null;
  eventType: ContentRealtimeEventType;
  parentId: string | null;
  likeCount: number | null;
  op: 'insert' | 'update' | 'delete' | null;
  operationId: string;
  supportCount: number | null;
  targetId: string;
  domainRevision: number;
}

function normalizeNullableString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function normalizeDate(value: unknown) {
  if (typeof value === 'string') {
    const time = Date.parse(value);
    return Number.isFinite(time) ? new Date(time) : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value);
  return null;
}

function normalizeEventType(value: unknown): ContentRealtimeEventType | null {
  if (
    value === 'issue_changed'
    || value === 'issue_support_changed'
    || value === 'issue_comment_changed'
    || value === 'announcement_changed'
    || value === 'announcement_metrics_changed'
    || value === 'announcement_comment_changed'
    || value === 'facility_changed'
  ) return value;
  return null;
}

function normalizeRealtimeEvent(data: Record<string, unknown>): ContentRealtimeEvent | null {
  const eventType = normalizeEventType(data.eventType);
  const targetId = normalizeNullableString(data.targetId);
  if (!eventType || !targetId) return null;
  return {
    aggregateRevision: typeof data.aggregateRevision === 'number' && Number.isFinite(data.aggregateRevision)
      ? data.aggregateRevision
      : 0,
    category: normalizeNullableString(data.category),
    commentCount: typeof data.commentCount === 'number' && Number.isFinite(data.commentCount)
      ? data.commentCount
      : null,
    createdAt: normalizeDate(data.createdAt),
    eventType,
    likeCount: typeof data.likeCount === 'number' && Number.isFinite(data.likeCount)
      ? data.likeCount
      : null,
    op: data.op === 'insert' || data.op === 'update' || data.op === 'delete' ? data.op : null,
    operationId: normalizeNullableString(data.operationId) ?? '',
    parentId: normalizeNullableString(data.parentId),
    supportCount: typeof data.supportCount === 'number' && Number.isFinite(data.supportCount)
      ? data.supportCount
      : null,
    targetId,
    domainRevision: typeof data.domainRevision === 'number' && Number.isFinite(data.domainRevision) ? data.domainRevision : 0,
  };
}

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
        support_count: event.supportCount,
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
    if (event.likeCount !== null) patch.like_count = event.likeCount;
    if (event.commentCount !== null) patch.comment_count = event.commentCount;
    if (Object.keys(patch).length > 0) {
      patchContentEntity<AnnouncementRecord>(scope, 'announcement', announcementId, patch, {
        serverRevision: event.aggregateRevision,
      });
    }
  }
}

function receiveContentEvent(payload: Record<string, unknown>) {
  const event = normalizeRealtimeEvent(payload);
  if (!event) return;
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
  const onResync = () => void ensureContentVersionsFresh({ notify: true });
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
) {
  void channelScope;
  const subscriberId = realtimeSubscriberSerial += 1;
  realtimeSubscribers.set(subscriberId, { callback });
  ensureContentTopics();
  return () => {
    realtimeSubscribers.delete(subscriberId);
    if (!realtimeSessionActive && realtimeSubscribers.size === 0) disconnectContentTopics();
  };
}
