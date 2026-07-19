import { getSupabaseClient } from '@/lib/supabase';
import { isIssueCategory } from '@/constants/categories';
import type {
  IssueCategory,
  IssueStatus,
  NotificationRecord,
  NotificationSource,
  NotificationTargetType,
  NotificationType,
} from '@/types';
import { invokeBackendAction } from '@/services/backend-action';
import { READ_REQUEST_TIMEOUT_MS } from '@/lib/request';
import {
  normalizeDate,
  normalizeStatus,
  toReadableBackendError,
} from './issues-core';
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

const NOTIFICATION_PAGES_CACHE_PREFIX = 'notification-pages|';
const NOTIFICATION_STATE_CACHE_KEY = 'notification-read-state';
const NOTIFICATION_UNREAD_CACHE_KEY = 'notification-unread-hint';
const PUSH_PREFERENCE_CACHE_PREFIX = 'push-notification-preference|';
const NOTIFICATION_HINT_CACHE_TTL_MS = 2 * 60_000;

type NotificationBroadcastMessage = { payload: Record<string, unknown> };
interface NotificationBroadcastListener {
  callback: (message: NotificationBroadcastMessage) => void;
  onError?: (error: Error) => void;
}
interface NotificationBroadcastTopic {
  channel: ReturnType<ReturnType<typeof getSupabaseClient>['channel']>;
  listeners: Map<number, NotificationBroadcastListener>;
}

const notificationBroadcastTopics = new Map<string, NotificationBroadcastTopic>();
let notificationBroadcastListenerId = 0;

function subscribeNotificationBroadcast(
  topic: string,
  event: 'notification_insert' | 'notification_state_changed',
  callback: NotificationBroadcastListener['callback'],
  onError?: (error: Error) => void,
) {
  const listenerId = notificationBroadcastListenerId += 1;
  let subscription = notificationBroadcastTopics.get(topic);
  if (!subscription) {
    const listeners = new Map<number, NotificationBroadcastListener>();
    const client = getSupabaseClient();
    const channel = client.channel(topic, { config: { private: true } })
      .on<Record<string, unknown>>('broadcast', { event }, (message) => {
        if (event === 'notification_insert') {
          markContentCachePrefixStale(NOTIFICATION_PAGES_CACHE_PREFIX);
          markContentCachePrefixStale(NOTIFICATION_UNREAD_CACHE_KEY);
          if (message.payload.type === 'facility_status_changed' || message.payload.type === 'facility_report_created') {
            markContentCachePrefixStale('facility-list-page|');
            markContentCachePrefixStale('facility-detail|');
          }
        } else {
          markContentCachePrefixStale(NOTIFICATION_STATE_CACHE_KEY);
          markContentCachePrefixStale(NOTIFICATION_UNREAD_CACHE_KEY);
        }
        listeners.forEach((listener) => listener.callback({ payload: message.payload }));
      })
      .subscribe((status) => {
        if (status !== 'CHANNEL_ERROR' && status !== 'TIMED_OUT') return;
        const error = new Error('notification-realtime-unavailable');
        listeners.forEach((listener) => listener.onError?.(error));
      });
    subscription = { channel, listeners };
    notificationBroadcastTopics.set(topic, subscription);
  }
  subscription.listeners.set(listenerId, { callback, onError });

  return () => {
    const current = notificationBroadcastTopics.get(topic);
    if (!current) return;
    current.listeners.delete(listenerId);
    if (current.listeners.size > 0) return;
    notificationBroadcastTopics.delete(topic);
    void getSupabaseClient().removeChannel(current.channel);
  };
}

export type NotificationCursor = { createdAtMs: number; id: string } | null;
export interface NotificationSourcePage {
  cursor: NotificationCursor;
  hasMore: boolean;
  notifications: NotificationRecord[];
}

export interface NotificationReadState {
  admin: Date | null;
  broadcast: Date | null;
  personalPreferences: PersonalPushPreferences;
  user: Date | null;
}

export type PushNotificationPermission = NotificationPermission | 'unsupported';
export type PersonalPushPreferenceKey = 'comments' | 'facilityUpdates' | 'issueUpdates';

export interface PersonalPushPreferences {
  comments: boolean;
  issueUpdates: boolean;
  facilityUpdates: boolean;
}

interface PushNotificationPreference {
  deviceEnabled: boolean;
  enabled: boolean;
  personalPreferences: PersonalPushPreferences;
  permission: PushNotificationPermission;
  tokenCount: number;
}

interface GetPushNotificationPreferencePayload {
  deviceId?: string;
  permission?: PushNotificationPermission;
  token?: string;
}

interface RegisterPushTokenPayload {
  deviceId: string;
  permission: NotificationPermission;
  platform: string;
  token: string;
  userAgent: string;
}

interface UnregisterPushTokenPayload {
  deviceId: string;
  permission?: PushNotificationPermission;
  token?: string;
}

interface UpdatePushNotificationPreferencesPayload {
  deviceId: string;
  permission?: PushNotificationPermission;
  preferences: Partial<PersonalPushPreferences>;
  token?: string;
}

function normalizeNotificationType(value: unknown): NotificationType {
  if (
    value === 'announcement_created'
    || value === 'announcement_comment_created'
    || value === 'facility_status_changed'
    || value === 'facility_report_created'
    || value === 'issue_comment_created'
    || value === 'issue_status_changed'
    || value === 'support_goal_met'
    || value === 'issue_deleted'
  ) {
    return value;
  }
  return 'issue_comment_created';
}

function normalizeNotificationCursor(data: unknown): NotificationCursor {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id : '';
  const createdAt = normalizeDate(record.createdAtMs ?? record.created_at);
  return id && createdAt ? { id, createdAtMs: createdAt.getTime() } : null;
}

function normalizeTargetType(value: unknown): NotificationTargetType {
  return value === 'announcement' || value === 'facility' ? value : 'issue';
}

function normalizeNullableString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function normalizeOptionalStatus(value: unknown): IssueStatus | import('@/types').FacilityStatus | undefined {
  if (value === 'unable-to-handle') return value;
  return typeof value === 'string' ? normalizeStatus(value) : undefined;
}

function normalizeNotificationRecord(
  source: NotificationSource,
  data: Record<string, unknown>,
): NotificationRecord {
  const id = String(data.id ?? '');
  return {
    id: `${source}:${id}`,
    source,
    type: normalizeNotificationType(data.type),
    target_type: normalizeTargetType(data.target_type),
    target_id: String(data.target_id ?? ''),
    comment_id: normalizeNullableString(data.comment_id),
    title: String(data.title ?? ''),
    actor_uid: normalizeNullableString(data.actor_uid),
    actor_name: normalizeNullableString(data.actor_name),
    actor_photo_url: normalizeNullableString(data.actor_photo_url),
    body_preview: normalizeNullableString(data.body_preview),
    issue_category: isIssueCategory(data.issue_category) ? data.issue_category : null,
    old_status: normalizeOptionalStatus(data.old_status),
    new_status: normalizeOptionalStatus(data.new_status),
    is_read: Boolean(data.is_read),
    created_at: normalizeDate(data.created_at_ms ?? data.created_at),
  };
}

export function subscribeNotificationSource(
  source: NotificationSource,
  uid: string,
  onInsert: (notification: NotificationRecord) => void,
  onError?: (error: Error) => void,
) {
  const channelName = source === 'user' ? `notifications:user:${uid}` : `notifications:${source}`;
  return subscribeNotificationBroadcast(
    channelName,
    'notification_insert',
    (message) => {
      const data = message.payload as Record<string, unknown>;
      if (data.source !== source) return;
      if (source === 'user' && data.recipient_uid !== uid) return;
      onInsert(normalizeNotificationRecord(source, data));
    },
    onError,
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
    ...requests.map(({ cursor, source }) => `${source}:${cursor?.id ?? 'first'}:${cursor?.createdAtMs ?? ''}`),
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
    >('listNotificationPages', { signal, timeoutMs: READ_REQUEST_TIMEOUT_MS });
    const result = await fn({
      requests: requests.map((request) => ({ ...request, pageSize: NOTIFICATION_FEED_PAGE_SIZE })),
      uid,
    });
    const pages = Object.fromEntries(requests.flatMap(({ source }) => {
      const page = result.pages[source];
      if (!page) return [];
      const notifications = Array.isArray(page.notifications) ? page.notifications : [];
      return [[source, {
        cursor: normalizeNotificationCursor(page.cursor),
        hasMore: page.hasMore === true,
        notifications: notifications.map((notification) => normalizeNotificationRecord(
          source,
          notification as Record<string, unknown>,
        )),
      } satisfies NotificationSourcePage]];
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
) {
  const channelName = `notification-state:${uid}`;
  const loadInitialState = () => {
    void getNotificationReadState(uid)
      .then(callback)
      .catch((error) => onError?.(toReadableBackendError(error)));
  };
  const unsubscribe = subscribeNotificationBroadcast(
    channelName,
    'notification_state_changed',
    (message) => {
      callback(normalizeNotificationReadState(message.payload as Record<string, unknown>));
    },
    onError,
  );
  if (loadInitial) loadInitialState();
  return unsubscribe;
}

async function getNotificationReadState(uid: string): Promise<NotificationReadState> {
  const cached = await getCachedContentPersistent<NotificationReadState>(
    NOTIFICATION_STATE_CACHE_KEY,
    CONTENT_SHORT_CACHE_TTL_MS,
  );
  if (cached) return cached;
  const cacheGuard = captureContentCacheWriteGuard(NOTIFICATION_STATE_CACHE_KEY);
  const fn = invokeBackendAction<{ uid: string }, { state: Record<string, unknown> }>('getNotificationReadState', {
    timeoutMs: READ_REQUEST_TIMEOUT_MS,
  });
  const result = await fn({ uid });
  const state = normalizeNotificationReadState(result.state);
  setCachedContentFromRead(cacheGuard, state);
  return state;
}

export async function fetchNotificationSnapshot(
  sources: NotificationSource[],
  uid: string,
  signal?: AbortSignal,
) {
  const fn = invokeBackendAction<
    { sources: NotificationSource[]; uid: string },
    { openedAtMs: number; pages: Partial<Record<NotificationSource, Record<string, unknown>>>; state: Record<string, unknown> }
  >('getNotificationSnapshot', { signal, timeoutMs: READ_REQUEST_TIMEOUT_MS });
  const result = await fn({ sources, uid });
  return {
    pages: Object.fromEntries(sources.map((source) => {
      const page = result.pages[source] ?? {};
      const notifications = Array.isArray(page.notifications) ? page.notifications : [];
      return [source, {
        cursor: normalizeNotificationCursor(page.cursor),
        hasMore: page.hasMore === true,
        notifications: notifications.map((notification) => normalizeNotificationRecord(
          source,
          notification as Record<string, unknown>,
        )),
      } satisfies NotificationSourcePage];
    })) as Record<NotificationSource, NotificationSourcePage>,
    openedAtMs: result.openedAtMs,
    state: normalizeNotificationReadState(result.state),
  };
}

export async function fetchNotificationUnreadHint() {
  const cached = await getCachedContentPersistent<{ value: boolean }>(
    NOTIFICATION_UNREAD_CACHE_KEY,
    NOTIFICATION_HINT_CACHE_TTL_MS,
  );
  if (cached) return cached.value;
  const cacheGuard = captureContentCacheWriteGuard(NOTIFICATION_UNREAD_CACHE_KEY);
  const fn = invokeBackendAction<Record<string, never>, { hasUnread: boolean }>('getNotificationUnreadHint', {
    timeoutMs: READ_REQUEST_TIMEOUT_MS,
  });
  const value = (await fn({})).hasUnread;
  setCachedContentFromRead(cacheGuard, { value });
  return value;
}

export function subscribeNotificationBadge(
  uid: string,
  _isAdmin: boolean,
  onNotification: () => void,
  onStateChanged: () => void,
  onError?: (error: Error) => void,
) {
  const topics = ['notifications:broadcast', `notifications:user:${uid}`, `notification-state:${uid}`];
  const unsubscribers = topics.map((topic) => subscribeNotificationBroadcast(
    topic,
    topic.startsWith('notification-state:') ? 'notification_state_changed' : 'notification_insert',
    topic.startsWith('notification-state:') ? onStateChanged : onNotification,
    onError,
  ));
  return () => { unsubscribers.forEach((unsubscribe) => unsubscribe()); };
}

function normalizeNotificationReadState(data: Record<string, unknown>): NotificationReadState {
  return {
    admin: normalizeDate(data.admin_opened_at_ms ?? data.admin_opened_at),
    broadcast: normalizeDate(data.broadcast_opened_at_ms ?? data.broadcast_opened_at),
    personalPreferences: {
      comments: data.push_comments_enabled !== false,
      issueUpdates: data.push_issue_updates_enabled !== false,
      facilityUpdates: data.push_facility_updates_enabled !== false,
    },
    user: normalizeDate(data.user_opened_at_ms ?? data.user_opened_at),
  };
}

export async function markNotificationsOpened() {
  try {
    const fn = invokeBackendAction<Record<string, never>, { openedAtMs: number; success: boolean }>('markNotificationsOpened');
    const result = await fn({});
    markContentCachePrefixStale(NOTIFICATION_STATE_CACHE_KEY);
    setCachedContent(NOTIFICATION_UNREAD_CACHE_KEY, { value: false });
    return result;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}

export async function getPushNotificationPreference(payload: GetPushNotificationPreferencePayload = {}) {
  const cacheKey = createContentCacheKey([
    'push-notification-preference',
    payload.deviceId ?? '',
    payload.permission ?? '',
    payload.token ?? '',
  ]);
  const cached = await getCachedContentPersistent<PushNotificationPreference>(
    cacheKey,
    CONTENT_SHORT_CACHE_TTL_MS,
  );
  if (cached) return cached;
  const cacheGuard = captureContentCacheWriteGuard(cacheKey);
  try {
    const fn = invokeBackendAction<GetPushNotificationPreferencePayload, PushNotificationPreference>('getPushNotificationPreference');
    const result = await fn(payload);
    setCachedContentFromRead(cacheGuard, result);
    return result;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}

export async function registerPushToken(payload: RegisterPushTokenPayload) {
  try {
    const fn = invokeBackendAction<RegisterPushTokenPayload, PushNotificationPreference>('registerPushToken');
    const result = await fn(payload);
    markContentCachePrefixStale(PUSH_PREFERENCE_CACHE_PREFIX);
    return result;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}

export async function unregisterPushToken(payload: UnregisterPushTokenPayload) {
  try {
    const fn = invokeBackendAction<UnregisterPushTokenPayload, PushNotificationPreference>('unregisterPushToken');
    const result = await fn(payload);
    markContentCachePrefixStale(PUSH_PREFERENCE_CACHE_PREFIX);
    return result;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}

export async function updatePushNotificationPreferences(payload: UpdatePushNotificationPreferencesPayload) {
  try {
    const fn = invokeBackendAction<UpdatePushNotificationPreferencesPayload, PushNotificationPreference>('updatePushNotificationPreferences');
    const result = await fn(payload);
    markContentCachePrefixStale(PUSH_PREFERENCE_CACHE_PREFIX);
    return result;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}
