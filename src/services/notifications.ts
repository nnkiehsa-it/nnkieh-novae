import type { NotificationCursor, NotificationPage, NotificationReadState, NotificationSource } from '@shared/contracts/notifications.ts';
import type { RealtimeEventName, RealtimePayload } from '@shared/contracts/realtime.ts';
import { subscribeRealtimeTopic } from '@/services/realtime-transport';
import type { NotificationRecord } from '@/types';
import { callAction } from '@/services/backend-action';
import { readRequestTimeoutMs } from '@/lib/request';
import { toReadableBackendError } from './issues-core';
import { NOTIFICATION_FEED_PAGE_SIZE } from '@/lib/page-size';
import {
  CONTENT_SHORT_CACHE_TTL_MS,
  captureContentCacheWriteGuard,
  createContentCacheKey,
  getCachedContentPersistent,
  markContentCachePrefixStale,
  setCachedContent,
  setCachedContentFromRead,
} from '@/services/content-read-cache';

export type { NotificationCursor, NotificationPage } from '@shared/contracts/notifications.ts';
export type NotificationPages = Partial<Record<NotificationSource, NotificationPage>>;

const NOTIFICATION_PAGES_CACHE_PREFIX = 'notification-pages|';
const NOTIFICATION_STATE_CACHE_KEY = 'notification-read-state';
const NOTIFICATION_UNREAD_CACHE_KEY = 'notification-unread-hint';
const NOTIFICATION_HINT_CACHE_TTL_MS = 2 * 60_000;

type NotificationBroadcastEvent = Extract<RealtimeEventName, 'notification_insert' | 'notification_state_changed'>;

function subscribeNotificationBroadcast<E extends NotificationBroadcastEvent>(
  topic: string,
  event: E,
  callback: (payload: RealtimePayload<E>) => void,
  onError?: (error: Error) => void,
  onResync?: () => void,
) {
  return subscribeRealtimeTopic(topic, event, (payload) => {
    if ('type' in payload) {
      markContentCachePrefixStale(NOTIFICATION_PAGES_CACHE_PREFIX);
      markContentCachePrefixStale(NOTIFICATION_UNREAD_CACHE_KEY);
      if (payload.type === 'facility_status_changed' || payload.type === 'facility_report_created') {
        markContentCachePrefixStale('facility-list-page|');
        markContentCachePrefixStale('facility-detail|');
      }
    } else {
      markContentCachePrefixStale(NOTIFICATION_STATE_CACHE_KEY);
      markContentCachePrefixStale(NOTIFICATION_UNREAD_CACHE_KEY);
    }
    callback(payload);
  }, { onError, onResync });
}

export function subscribeNotificationSource(
  source: NotificationSource,
  uid: string,
  onInsert: (notification: NotificationRecord) => void,
  onError?: (error: Error) => void,
  onResync?: () => void,
) {
  const channelName = source === 'user' ? `notifications:user:${uid}` : `notifications:${source}`;
  return subscribeNotificationBroadcast(
    channelName,
    'notification_insert',
    ({ recipientUid, ...notification }) => {
      if (notification.source !== source) return;
      if (source === 'user' && recipientUid !== uid) return;
      onInsert(notification);
    },
    onError,
    onResync,
  );
}

export async function fetchNotificationSourcePages(
  requests: Array<{ cursor: NotificationCursor | null; source: NotificationSource }>,
  uid: string,
  signal?: AbortSignal,
): Promise<NotificationPages> {
  const cacheKey = createContentCacheKey([
    'notification-pages',
    uid,
    ...requests.map(({ cursor, source }) => `${source}:${cursor?.id ?? 'first'}:${cursor?.createdAt ?? ''}`),
  ]);
  const cached = await getCachedContentPersistent<NotificationPages>(
    cacheKey,
    CONTENT_SHORT_CACHE_TTL_MS,
  );
  if (cached) return cached;
  const cacheGuard = captureContentCacheWriteGuard(cacheKey);

  try {
    const { pages } = await callAction('listNotificationPages', {
      requests: requests.map((request) => ({ ...request, pageSize: NOTIFICATION_FEED_PAGE_SIZE })),
    }, { signal, timeoutMs: readRequestTimeoutMs });
    setCachedContentFromRead(cacheGuard, pages);
    return pages;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}

export function subscribeNotificationReadState(
  uid: string,
  callback: (state: NotificationReadState) => void,
  onError?: (error: Error) => void,
  loadInitial = true,
  onResync?: () => void,
) {
  const channelName = `notification-state:${uid}`;
  let active = true;
  let revision = 0;
  const loadInitialState = () => {
    const requestRevision = revision;
    void getNotificationReadState()
      .then((state) => { if (active && requestRevision === revision) callback(state); })
      .catch((error) => { if (active && requestRevision === revision) onError?.(toReadableBackendError(error)); });
  };
  const unsubscribe = subscribeNotificationBroadcast(
    channelName,
    'notification_state_changed',
    (state) => {
      revision += 1;
      callback(state);
    },
    onError,
    onResync,
  );
  if (loadInitial) loadInitialState();
  return () => { active = false; unsubscribe(); };
}

async function getNotificationReadState(): Promise<NotificationReadState> {
  const cached = await getCachedContentPersistent<NotificationReadState>(
    NOTIFICATION_STATE_CACHE_KEY,
    CONTENT_SHORT_CACHE_TTL_MS,
  );
  if (cached) return cached;
  const cacheGuard = captureContentCacheWriteGuard(NOTIFICATION_STATE_CACHE_KEY);
  const { state } = await callAction('getNotificationReadState', {}, { timeoutMs: readRequestTimeoutMs });
  setCachedContentFromRead(cacheGuard, state);
  return state;
}

export async function fetchNotificationSnapshot(
  sources: NotificationSource[],
  options: {
    onPages?: (pages: NotificationPages) => void;
    signal?: AbortSignal;
  } = {},
) {
  return await callAction('getNotificationSnapshot', { sources }, {
    onSegment: (key, data) => {
      if (key === 'pages') options.onPages?.(data as NotificationPages);
    },
    signal: options.signal,
    timeoutMs: readRequestTimeoutMs,
  });
}

export function seedNotificationUnreadHint(hasUnread: boolean) {
  setCachedContent(NOTIFICATION_UNREAD_CACHE_KEY, { value: hasUnread === true });
  return hasUnread === true;
}

export async function fetchNotificationUnreadHint(options: { forceRefresh?: boolean } = {}) {
  const cached = options.forceRefresh ? null : await getCachedContentPersistent<{ value: boolean }>(
    NOTIFICATION_UNREAD_CACHE_KEY,
    NOTIFICATION_HINT_CACHE_TTL_MS,
  );
  if (cached) return cached.value;
  const cacheGuard = captureContentCacheWriteGuard(NOTIFICATION_UNREAD_CACHE_KEY);
  const { hasUnread: value } = await callAction('getNotificationUnreadHint', {}, { timeoutMs: readRequestTimeoutMs });
  setCachedContentFromRead(cacheGuard, { value });
  return value;
}

export function subscribeNotificationBadge(
  uid: string,
  isAdmin: boolean,
  onNotification: () => void,
  onStateChanged: () => void,
  onError?: (error: Error) => void,
  onResync?: () => void,
) {
  const topics = [
    'notifications:broadcast',
    `notifications:user:${uid}`,
    ...(isAdmin ? ['notifications:admin'] as const : []),
    `notification-state:${uid}`,
  ];
  const unsubscribers = topics.map((topic) => subscribeNotificationBroadcast(
    topic,
    topic.startsWith('notification-state:') ? 'notification_state_changed' : 'notification_insert',
    topic.startsWith('notification-state:') ? onStateChanged : onNotification,
    onError,
    onResync ?? onStateChanged,
  ));
  return () => { unsubscribers.forEach((unsubscribe) => unsubscribe()); };
}

export async function markNotificationsOpened() {
  try {
    const result = await callAction('markNotificationsOpened', {});
    markContentCachePrefixStale(NOTIFICATION_STATE_CACHE_KEY);
    setCachedContent(NOTIFICATION_UNREAD_CACHE_KEY, { value: false });
    return result;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}
