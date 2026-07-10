import { computed, ref, watch } from 'vue';
import type { NotificationRecord, NotificationSource } from '@/types';
import { useSession } from '@/composables/useSession';
import { registerAppResumeHandler } from '@/composables/useAppResume';
import {
  fetchNotificationSourcePage,
  fetchNotificationSnapshot,
  markNotificationsOpened,
  subscribeNotificationReadState,
  subscribeNotificationSource,
  type NotificationReadState,
} from '@/services/notifications';
import { resetAppConnection } from '@/lib/reconnect';

type Unsubscribe = () => void;

const notificationSources: NotificationSource[] = ['broadcast', 'admin', 'user'];
const NOTIFICATION_RESUME_RECONNECT_MS = 10 * 60_000;
const defaultPersonalPreferences = {
  comments: true,
  issueUpdates: true,
};
type NotificationCursor = Awaited<ReturnType<typeof fetchNotificationSourcePage>>['cursor'];

function emptySourceRecord<T>(createValue: () => T): Record<NotificationSource, T> {
  return {
    broadcast: createValue(),
    admin: createValue(),
    user: createValue(),
  };
}

function isOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

function notificationLoadFailureMessage() {
  return isOnline()
    ? '通知載入失敗，請稍後再試。'
    : '目前已離線，請恢復網路連線後重新整理。';
}

const { user, isAdmin, roleLoading } = useSession();
const firstPages = ref(emptySourceRecord<NotificationRecord[]>(() => []));
const extraPages = ref(emptySourceRecord<NotificationRecord[]>(() => []));
const cursors = ref(emptySourceRecord<NotificationCursor>(() => null));
const sourceHasMore = ref(emptySourceRecord(() => false));
const readState = ref<NotificationReadState>({
  admin: null,
  broadcast: null,
  personalPreferences: { ...defaultPersonalPreferences },
  user: null,
});
const loading = ref(false);
const loadingMore = ref(false);
const error = ref('');
let initialized = false;
let loadingTimer: number | null = null;
let lastSubscriptionStartedAt = 0;
let subscriptionVersion = 0;
let unsubscribes: Unsubscribe[] = [];

const activeSources = computed<NotificationSource[]>(() =>
  isAdmin.value ? notificationSources : ['broadcast', 'user'],
);

const notifications = computed(() => {
  const items = activeSources.value.flatMap((source) => {
    const firstPageIdSet = new Set(firstPages.value[source].map((notification) => notification.id));
    return [
      ...firstPages.value[source],
      ...extraPages.value[source].filter((notification) => !firstPageIdSet.has(notification.id)),
    ];
  });

  return items
    .map((notification) => ({
      ...notification,
      is_read: Boolean(
        notification.created_at
        && readState.value[notification.source]
        && notification.created_at <= readState.value[notification.source]!,
      ),
    }))
    .sort((left, right) =>
      (right.created_at?.getTime() ?? 0) - (left.created_at?.getTime() ?? 0),
    );
});
const hasUnread = computed(() => notifications.value.some((notification) => !notification.is_read));
const hasMore = computed(() => activeSources.value.some((source) => sourceHasMore.value[source]));

function clearLoadingTimer() {
  if (loadingTimer !== null) window.clearTimeout(loadingTimer);
  loadingTimer = null;
}

function clearSubscriptions() {
  clearLoadingTimer();
  subscriptionVersion += 1;
  unsubscribes.forEach((unsubscribe) => unsubscribe());
  unsubscribes = [];
  firstPages.value = emptySourceRecord(() => []);
  extraPages.value = emptySourceRecord(() => []);
  cursors.value = emptySourceRecord(() => null);
  sourceHasMore.value = emptySourceRecord(() => false);
  readState.value = {
    admin: null,
    broadcast: null,
    personalPreferences: { ...defaultPersonalPreferences },
    user: null,
  };
}

function insertRealtimeNotification(source: NotificationSource, notification: NotificationRecord) {
  const alreadyLoaded = [...firstPages.value[source], ...extraPages.value[source]]
    .some((item) => item.id === notification.id);
  if (alreadyLoaded) return;
  firstPages.value[source] = [notification, ...firstPages.value[source]];
}

function startSubscriptions() {
  const uid = user.value?.uid ?? '';
  clearSubscriptions();
  if (!uid || roleLoading.value) return;
  lastSubscriptionStartedAt = Date.now();

  loading.value = true;
  error.value = '';
  const currentVersion = subscriptionVersion;
  const pendingSources = new Set(activeSources.value);
  const failedSources = new Set<NotificationSource>();
  const finishSourceLoad = (source: NotificationSource, failed: boolean) => {
    pendingSources.delete(source);
    if (failed) failedSources.add(source);
    else failedSources.delete(source);
    loading.value = pendingSources.size > 0;
    if (!loading.value) {
      clearLoadingTimer();
      error.value = failedSources.size === activeSources.value.length
        && notifications.value.length === 0
        ? notificationLoadFailureMessage()
        : '';
    }
  };
  loadingTimer = window.setTimeout(() => {
    if (currentVersion !== subscriptionVersion) return;
    loading.value = false;
    error.value = isOnline()
      ? '網路回應時間過長，請重新整理。'
      : '目前已離線，請恢復網路連線後重新整理。';
  }, 5_000);

  void fetchNotificationSnapshot(activeSources.value, uid)
    .then((snapshot) => {
      if (currentVersion !== subscriptionVersion) return;
      activeSources.value.forEach((source) => {
        const page = snapshot.pages[source];
        firstPages.value[source] = page.notifications;
        cursors.value[source] = page.cursor;
        sourceHasMore.value[source] = page.hasMore;
        finishSourceLoad(source, false);
      });
      readState.value = snapshot.state;
    })
    .catch(() => {
      if (currentVersion !== subscriptionVersion) return;
      activeSources.value.forEach((source) => finishSourceLoad(source, true));
    });

  activeSources.value.forEach((source) => {
    unsubscribes.push(subscribeNotificationSource(
      source,
      uid,
      (notification) => {
        if (currentVersion !== subscriptionVersion) return;
        insertRealtimeNotification(source, notification);
      },
      () => {
        if (currentVersion !== subscriptionVersion) return;
        finishSourceLoad(source, true);
      },
    ));
  });

  unsubscribes.push(subscribeNotificationReadState(
    uid,
    (state) => {
      if (currentVersion === subscriptionVersion) readState.value = state;
    },
    () => {
      if (
        currentVersion === subscriptionVersion
        && notifications.value.length === 0
      ) {
        error.value = '通知狀態載入失敗，請稍後再試。';
      }
    }, false,
  ));

}

function reconnectNotificationsAfterResume() {
  if (!user.value?.uid || roleLoading.value) return;
  if (!error.value && Date.now() - lastSubscriptionStartedAt < NOTIFICATION_RESUME_RECONNECT_MS) return;
  startSubscriptions();
}

function ensureNotificationsInitialized() {
  if (initialized) return;
  initialized = true;

  watch(
    () => [user.value?.uid ?? '', isAdmin.value, roleLoading.value] as const,
    startSubscriptions,
    { immediate: true },
  );
  registerAppResumeHandler(reconnectNotificationsAfterResume);

  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      if (error.value && user.value?.uid) startSubscriptions();
    });
  }
}

async function openNotifications() {
  if (!user.value) return;

  try {
    const result = await markNotificationsOpened();
    const openedAt = new Date(result.openedAtMs);
    readState.value = {
      broadcast: openedAt,
      user: openedAt,
      admin: isAdmin.value ? openedAt : readState.value.admin,
      personalPreferences: readState.value.personalPreferences,
    };
  } catch {
    void 0;
  }
}

async function retryNotifications() {
  await resetAppConnection();
  startSubscriptions();
}

async function loadMoreNotifications() {
  const uid = user.value?.uid;
  if (!uid || !hasMore.value || loadingMore.value) return;

  loadingMore.value = true;
  error.value = '';
  try {
    const results = await Promise.allSettled(activeSources.value.map(async (source) => {
      const cursor = cursors.value[source];
      if (!cursor || !sourceHasMore.value[source]) return;

      const page = await fetchNotificationSourcePage(source, uid, cursor);
      const existingIds = new Set([
        ...firstPages.value[source],
        ...extraPages.value[source],
      ].map((notification) => notification.id));
      extraPages.value[source] = [
        ...extraPages.value[source],
        ...page.notifications.filter((notification) => !existingIds.has(notification.id)),
      ];
      cursors.value[source] = page.cursor;
      sourceHasMore.value[source] = page.hasMore;
    }));
    if (results.some((result) => result.status === 'rejected')) {
      error.value = results.every((result) => result.status === 'rejected')
        ? notificationLoadFailureMessage()
        : '部分通知暫時無法載入。';
    }
  } catch {
    error.value = notificationLoadFailureMessage();
  } finally {
    loadingMore.value = false;
  }
}

export function useNotifications() {
  ensureNotificationsInitialized();

  return {
    notifications,
    hasUnread,
    hasMore,
    loading,
    loadingMore,
    error,
    openNotifications,
    loadMoreNotifications,
    retryNotifications,
  };
}
