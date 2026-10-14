import type { NotificationCursor, NotificationPage, NotificationReadState, NotificationSource } from '@shared/contracts/notifications.ts';
import type { RealtimeEventName, RealtimePayload } from '@shared/contracts/realtime.ts';
import { subscribeRealtimeTopic } from '@/services/realtime-transport';
import type { NotificationRecord } from '@/types';
import { callAction } from '@/services/backend-action';
import { readRequestTimeoutMs } from '@/lib/request';
import { toReadableBackendError } from './backend-errors';
import { NOTIFICATION_FEED_PAGE_SIZE } from '@/lib/page-size';
import { invalidate, queryClient, readQuery } from '@/lib/query-client';
import { facilityKeys } from '@/services/facilities';

export type { NotificationCursor, NotificationPage } from '@shared/contracts/notifications.ts';
export type NotificationPages = Partial<Record<NotificationSource, NotificationPage>>;

export const notificationKeys = {
  list: (sources: readonly NotificationSource[]) => ['notifications', 'list', sources.join(',')] as const,
  state: () => ['notifications', 'state'] as const,
  unread: () => ['notifications', 'unread'] as const,
};
const READ_STATE_MAX_AGE_MS = 10 * 60_000;

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
      // The open notifications page adds the new one itself; a later visit reads them again.
      void queryClient.invalidateQueries({ queryKey: ['notifications', 'list'], refetchType: 'none' });
      queryClient.setQueryData(notificationKeys.unread(), true);
      if (payload.type === 'facility_status_changed' || payload.type === 'facility_report_created') {
        void invalidate(['facilities', 'list']);
        void invalidate(facilityKeys.detail(payload.targetId));
      }
    } else {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.state(), refetchType: 'none' });
      void invalidate(notificationKeys.unread());
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
  signal?: AbortSignal,
): Promise<NotificationPages> {
  try {
    const { pages } = await callAction('listNotificationPages', {
      requests: requests.map((request) => ({ ...request, pageSize: NOTIFICATION_FEED_PAGE_SIZE })),
    }, { signal, timeoutMs: readRequestTimeoutMs });
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

function getNotificationReadState(): Promise<NotificationReadState> {
  return readQuery(notificationKeys.state(), async () =>
    (await callAction('getNotificationReadState', {}, { timeoutMs: readRequestTimeoutMs })).state, READ_STATE_MAX_AGE_MS);
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
  queryClient.setQueryData(notificationKeys.unread(), hasUnread);
}

export async function fetchNotificationUnreadHint() {
  return (await callAction('getNotificationUnreadHint', {}, { timeoutMs: readRequestTimeoutMs })).hasUnread;
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
    void queryClient.invalidateQueries({ queryKey: notificationKeys.state(), refetchType: 'none' });
    queryClient.setQueryData(notificationKeys.unread(), false);
    return result;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}
