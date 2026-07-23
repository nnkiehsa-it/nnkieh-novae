import { getSupabaseClient } from '@/lib/supabase';
import { auth } from '@/lib/firebase';
import { isIssueCategory } from '@/constants/categories';
import { getCachedSessionRole } from '@/services/session-role';
import type { IssueCategory } from '@/types';
import { markContentCachePrefixStale } from '@/services/content-read-cache';

type SupabaseAppClient = ReturnType<typeof getSupabaseClient>;
type RealtimeChannel = ReturnType<SupabaseAppClient['channel']>;
interface RealtimeSubscriber {
  callback: (event: ContentRealtimeEvent) => void;
  onError?: (error: Error) => void;
  onResync?: () => void;
}

const realtimeSubscribers = new Map<number, RealtimeSubscriber>();
let realtimeSubscriberSerial = 0;
let realtimeChannelSerial = 0;
let sharedRealtimeChannels: RealtimeChannel[] = [];
let sharedRealtimeKey = '';
let reconnectAttempt = 0;
let reconnectTimer = 0;
let resyncAfterReconnect = false;

function clearReconnectTimer() {
  window.clearTimeout(reconnectTimer);
  reconnectTimer = 0;
}

function scheduleReconnect() {
  if (realtimeSubscribers.size === 0 || reconnectTimer) return;
  const delay = Math.min(30_000, 1_000 * 2 ** reconnectAttempt);
  reconnectAttempt += 1;
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = 0;
    ensureSharedRealtimeChannel();
  }, delay);
}

export type ContentRealtimeEventType =
  | 'issue_changed'
  | 'issue_support_changed'
  | 'issue_comment_changed'
  | 'announcement_changed'
  | 'announcement_metrics_changed'
  | 'announcement_comment_changed';

export interface ContentRealtimeEvent {
  category: IssueCategory | null;
  commentCount: number | null;
  createdAt: Date | null;
  eventType: ContentRealtimeEventType;
  parentId: string | null;
  likeCount: number | null;
  op: 'insert' | 'update' | 'delete' | null;
  supportCount: number | null;
  targetId: string;
}

function normalizeNullableString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function normalizeDate(value: unknown) {
  if (typeof value === 'string') {
    const time = Date.parse(value);
    return Number.isFinite(time) ? new Date(time) : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value);
  }
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
  ) {
    return value;
  }
  return null;
}

function normalizeRealtimeEvent(data: Record<string, unknown>): ContentRealtimeEvent | null {
  const eventType = normalizeEventType(data.event_type);
  const targetId = normalizeNullableString(data.target_id);
  if (!eventType || !targetId) return null;

  return {
    category: isIssueCategory(data.category) ? data.category : null,
    commentCount: typeof data.comment_count === 'number' && Number.isFinite(data.comment_count)
      ? data.comment_count
      : null,
    createdAt: normalizeDate(data.created_at),
    eventType,
    likeCount: typeof data.like_count === 'number' && Number.isFinite(data.like_count)
      ? data.like_count
      : null,
    op: data.op === 'insert' || data.op === 'update' || data.op === 'delete' ? data.op : null,
    parentId: normalizeNullableString(data.parent_id),
    supportCount: typeof data.support_count === 'number' && Number.isFinite(data.support_count)
      ? data.support_count
      : null,
    targetId,
  };
}

function ensureSharedRealtimeChannel() {
  const uid = auth?.currentUser?.uid;
  if (!uid || realtimeSubscribers.size === 0) return;
  const topics = ['content:school'];
  topics.push(getCachedSessionRole() === 'admin' ? 'content:admin' : `content:user:${uid}`);
  const realtimeKey = topics.join('|');
  const client = getSupabaseClient();
  if (sharedRealtimeChannels.length > 0) {
    if (sharedRealtimeKey === realtimeKey) return;
    const staleChannels = sharedRealtimeChannels;
    sharedRealtimeChannels = [];
    sharedRealtimeKey = '';
    realtimeChannelSerial += 1;
    staleChannels.forEach((channel) => void client.removeChannel(channel));
    resyncAfterReconnect = true;
  }
  clearReconnectTimer();
  const generation = realtimeChannelSerial += 1;
  let subscribedCount = 0;
  const channels = topics.map((topic) => {
    const channel = client
      .channel(topic, { config: { private: true } })
      .on('broadcast', { event: 'content_changed' }, (message) => {
        const event = normalizeRealtimeEvent(message.payload as Record<string, unknown>);
        if (!event) return;
        invalidateRealtimeContent(event);
        realtimeSubscribers.forEach((subscriber) => subscriber.callback(event));
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          subscribedCount += 1;
          if (subscribedCount === topics.length) {
            reconnectAttempt = 0;
            if (resyncAfterReconnect) {
              resyncAfterReconnect = false;
              realtimeSubscribers.forEach((subscriber) => subscriber.onResync?.());
            }
          }
          return;
        }
        if (status !== 'CHANNEL_ERROR' && status !== 'TIMED_OUT' && status !== 'CLOSED') return;
        if (generation !== realtimeChannelSerial || sharedRealtimeChannels.length === 0) return;
        const failedChannels = sharedRealtimeChannels;
        sharedRealtimeChannels = [];
        sharedRealtimeKey = '';
        resyncAfterReconnect = true;
        const error = new Error('content-realtime-unavailable');
        realtimeSubscribers.forEach((subscriber) => subscriber.onError?.(error));
        failedChannels.forEach((failedChannel) => void client.removeChannel(failedChannel));
        scheduleReconnect();
      });
    return channel;
  });
  sharedRealtimeChannels = channels;
  sharedRealtimeKey = realtimeKey;
}

function invalidateRealtimeContent(event: ContentRealtimeEvent) {
  if (event.eventType.startsWith('issue_')) {
    const issueId = event.eventType === 'issue_comment_changed'
      ? event.parentId
      : event.targetId;
    markContentCachePrefixStale('issue-list-page|');
    markContentCachePrefixStale('issue-search|');
    markContentCachePrefixStale('user-issue-list-page|');
    if (issueId) markContentCachePrefixStale(`issue-detail|${issueId}|`);
    if (event.eventType === 'issue_comment_changed') {
      if (issueId) markContentCachePrefixStale(`issue-comments-page|${issueId}|`);
    }
    return;
  }
  const announcementId = event.eventType === 'announcement_comment_changed'
    ? event.parentId
    : event.targetId;
  markContentCachePrefixStale('announcement-list-page|');
  if (announcementId) markContentCachePrefixStale(`announcement-detail|${announcementId}|`);
  if (event.eventType === 'announcement_comment_changed') {
    if (announcementId) markContentCachePrefixStale(`announcement-comments-page|${announcementId}|`);
  }
}

export function subscribeContentRealtimeEvents(
  channelScope: string,
  callback: (event: ContentRealtimeEvent) => void,
  onError?: (error: Error) => void,
  onResync?: () => void,
) {
  void channelScope;
  const subscriberId = realtimeSubscriberSerial += 1;
  realtimeSubscribers.set(subscriberId, { callback, onError, onResync });
  ensureSharedRealtimeChannel();

  return () => {
    realtimeSubscribers.delete(subscriberId);
    if (realtimeSubscribers.size > 0) return;
    clearReconnectTimer();
    reconnectAttempt = 0;
    if (sharedRealtimeChannels.length === 0) return;
    const client = getSupabaseClient();
    const channels = sharedRealtimeChannels;
    sharedRealtimeChannels = [];
    sharedRealtimeKey = '';
    resyncAfterReconnect = false;
    realtimeChannelSerial += 1;
    channels.forEach((channel) => void client.removeChannel(channel));
  };
}
