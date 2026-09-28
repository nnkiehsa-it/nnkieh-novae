import { subscribeRealtimeTopic } from '@/services/realtime-transport';
import type {
  NotificationRecord,
  NotificationSource,
} from '@/types';
import { invokeBackendAction } from '@/services/backend-action';
import { readRequestTimeoutMs } from '@/lib/request';
import { toReadableBackendError } from './issues-core';
import { NOTIFICATION_FEED_PAGE_SIZE } from '@/lib/page-size';
import type { NotificationCursor } from './notification-cursor';
export type { NotificationCursor } from './notification-cursor';
import { normalizeNotificationRecord, normalizeNotificationPage, normalizeNotificationReadState, type NotificationReadState, type NotificationSourcePage } from './notification-records';
export type { NotificationReadState, NotificationSourcePage } from './notification-records';
import {
  CONTENT_SHORT_CACHE_TTL_MS,
  captureContentCacheWriteGuard,
  createContentCacheKey,
  getCachedContentPersistent,
  markContentCachePrefixStale,
  setCachedContent,
  setCachedContentFromRead,
} from '@/services/content-read-cache';

const NOTIFICATION_PAGES_CACHE_PREFIX = 'notification-pages|';
const NOTIFICATION_STATE_CACHE_KEY = 'notification-read-state';
const NOTIFICATION_UNREAD_CACHE_KEY = 'notification-unread-hint';
const NOTIFICATION_HINT_CACHE_TTL_MS = 2 * 60_000;

type NotificationBroadcastEvent = 'notification_insert' | 'notification_state_changed';

function subscribeNotificationBroadcast(
  topic: string,
  event: NotificationBroadcastEvent,
  callback: (message: { payload: Record<string, unknown> }) => void,
  onError?: (error: Error) => void,
  onResync?: () => void,
) {
  return subscribeRealtimeTopic(topic, event, (payload) => {
    if (event === 'notification_insert') {
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
    callback({ payload });
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
    (message) => {
      const data = message.payload as Record<string, unknown>;
      if (data.source !== source) return;
      if (source === 'user' && data.recipientUid !== uid) return;
      onInsert(normalizeNotificationRecord(source, data));
    },
    onError,
    onResync,
  );
}

export async function fetchNotificationSourcePages(
  requests: Array<{ cursor: NotificationCursor; source: NotificationSource }>,
  uid: string,
  signal?: AbortSignal,
): Promise<Partial<Record<NotificationSource, NotificationSourcePage>>> {
  const cacheKey = createContentCacheKey([
    'notification-pages',
    uid,
    ...requests.map(({ cursor, source }) => `${source}:${cursor?.id ?? 'first'}:${cursor?.createdAt ?? ''}`),
  ]);
  const cached = await getCachedContentPersistent<Partial<Record<NotificationSource, NotificationSourcePage>>>(
    cacheKey,
    CONTENT_SHORT_CACHE_TTL_MS,
  );
  if (cached) return cached;
  const cacheGuard = captureContentCacheWriteGuard(cacheKey);

  try {
    const fn = invokeBackendAction<
      { requests: Array<{ cursor: NotificationCursor; pageSize: number; source: NotificationSource }>; uid: string },
      { pages: Partial<Record<NotificationSource, Record<string, unknown>>> }
    >('listNotificationPages', { signal, timeoutMs: readRequestTimeoutMs });
    const result = await fn({
      requests: requests.map((request) => ({ ...request, pageSize: NOTIFICATION_FEED_PAGE_SIZE })),
      uid,
    });
    const pages = Object.fromEntries(requests.flatMap(({ source }) => {
      const page = result.pages[source];
      if (!page) return [];
      return [[source, normalizeNotificationPage(source, page)]];
    })) as Partial<Record<NotificationSource, NotificationSourcePage>>;
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
    void getNotificationReadState(uid)
      .then((state) => { if (active && requestRevision === revision) callback(state); })
      .catch((error) => { if (active && requestRevision === revision) onError?.(toReadableBackendError(error)); });
  };
  const unsubscribe = subscribeNotificationBroadcast(
    channelName,
    'notification_state_changed',
    (message) => {
      revision += 1;
      callback(normalizeNotificationReadState(message.payload as Record<string, unknown>));
    },
    onError,
    onResync,
  );
  if (loadInitial) loadInitialState();
  return () => { active = false; unsubscribe(); };
}

async function getNotificationReadState(uid: string): Promise<NotificationReadState> {
  const cached = await getCachedContentPersistent<NotificationReadState>(
    NOTIFICATION_STATE_CACHE_KEY,
    CONTENT_SHORT_CACHE_TTL_MS,
  );
  if (cached) return cached;
  const cacheGuard = captureContentCacheWriteGuard(NOTIFICATION_STATE_CACHE_KEY);
  const fn = invokeBackendAction<{ uid: string }, { state: Record<string, unknown> }>('getNotificationReadState', {
    timeoutMs: readRequestTimeoutMs,
  });
  const result = await fn({ uid });
  const state = normalizeNotificationReadState(result.state);
  setCachedContentFromRead(cacheGuard, state);
  return state;
}

export async function fetchNotificationSnapshot(
  sources: NotificationSource[],
  uid: string,
  options: {
    onPages?: (pages: Record<NotificationSource, NotificationSourcePage>) => void;
    signal?: AbortSignal;
  } = {},
) {
  const normalizePages = (value: Partial<Record<NotificationSource, Record<string, unknown>>>) =>
    Object.fromEntries(sources.map((source) => [source, normalizeNotificationPage(source, value[source] ?? {})])) as Record<NotificationSource, NotificationSourcePage>;
  const fn = invokeBackendAction<
    { sources: NotificationSource[]; uid: string },
    { openedAt: string; pages: Partial<Record<NotificationSource, Record<string, unknown>>>; state: Record<string, unknown> }
  >('getNotificationSnapshot', {
    onSegment: (key, data) => {
      if (key === 'pages') options.onPages?.(normalizePages(data as Partial<Record<NotificationSource, Record<string, unknown>>>));
    },
    signal: options.signal,
    timeoutMs: readRequestTimeoutMs,
  });
  const result = await fn({ sources, uid });
  return {
    pages: normalizePages(result.pages),
    state: normalizeNotificationReadState(result.state),
  };
}

export function seedNotificationUnreadHint(hasUnread: boolean) {
  setCachedContent(NOTIFICATION_UNREAD_CACHE_KEY, { value: hasUnread === true });
  return hasUnread === true;
}

export async function fetchNotificationUnreadHint() {
  const cached = await getCachedContentPersistent<{ value: boolean }>(
    NOTIFICATION_UNREAD_CACHE_KEY,
    NOTIFICATION_HINT_CACHE_TTL_MS,
  );
  if (cached) return cached.value;
  const cacheGuard = captureContentCacheWriteGuard(NOTIFICATION_UNREAD_CACHE_KEY);
  const fn = invokeBackendAction<Record<string, never>, { hasUnread: boolean }>('getNotificationUnreadHint', {
    timeoutMs: readRequestTimeoutMs,
  });
  const value = (await fn({})).hasUnread;
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
    const fn = invokeBackendAction<Record<string, never>, { openedAt: string; success: boolean }>('markNotificationsOpened');
    const result = await fn({});
    markContentCachePrefixStale(NOTIFICATION_STATE_CACHE_KEY);
    setCachedContent(NOTIFICATION_UNREAD_CACHE_KEY, { value: false });
    return result;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}
