import { computed, readonly, ref, watch } from 'vue';
import { deleteToken, getToken, onMessage, type Messaging } from 'firebase/messaging';
import { firebaseVapidKey, messagingPromise } from '@/lib/firebase';
import { requestAppInstallPrompt, shouldInstallPwaBeforePush } from '@/lib/pwa-install';
import { withRequestTimeout } from '@/lib/request';
import { useSession } from '@/composables/useSession';
import { useToast } from '@/composables/useToast';
import {
  getPushNotificationPreference,
  registerPushToken,
  unregisterPushToken,
  updatePushNotificationPreferences,
  type PersonalPushPreferenceKey,
  type PersonalPushPreferences,
  type PushNotificationPermission,
} from '@/services/notifications';

const PUSH_SERVICE_TIMEOUT_MS = 10_000;
const PUSH_TOKEN_TIMEOUT_MS = 15_000;
const PUSH_DEVICE_ID_STORAGE_KEY = 'srp:push-device-id';
const supported = ref(false);
const permission = ref<PushNotificationPermission>('default');
const deviceEnabled = ref(false);
const loading = ref(false);
const error = ref('');
const initialized = ref(false);
const personalPreferences = ref<PersonalPushPreferences>({
  comments: true,
  issueUpdates: true,
});
let currentToken = '';
let foregroundUnsubscribe: (() => void) | null = null;

function readOrCreatePushDeviceId() {
  if (typeof window === 'undefined') return '';
  const existing = localStorage.getItem(PUSH_DEVICE_ID_STORAGE_KEY)?.trim() ?? '';
  if (existing) return existing;
  const nextId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `push-device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(PUSH_DEVICE_ID_STORAGE_KEY, nextId);
  return nextId;
}

function browserPermission(): PushNotificationPermission {
  if (!('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

function readableError(value: unknown) {
  return value instanceof Error ? value.message : '推播通知暫時無法設定，請稍後再試。';
}

async function resolveMessaging() {
  if (!firebaseVapidKey) {
    supported.value = false;
    permission.value = 'unsupported';
    return null;
  }

  const messaging = await messagingPromise;
  supported.value = Boolean(messaging) && 'Notification' in window && 'serviceWorker' in navigator;
  if (!supported.value) {
    permission.value = 'unsupported';
    return null;
  }
  permission.value = browserPermission();
  return messaging;
}

async function waitForPushServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    throw new Error('此瀏覽器或裝置無法接收推播通知。');
  }

  return withRequestTimeout(
    () => navigator.serviceWorker.ready,
    { label: '推播服務啟動', timeoutMs: PUSH_SERVICE_TIMEOUT_MS },
  );
}

async function getPushToken(messaging: Messaging) {
  const registration = await waitForPushServiceWorker();
  return withRequestTimeout(
    () => getToken(messaging, {
      vapidKey: firebaseVapidKey,
      serviceWorkerRegistration: registration,
    }),
    { label: '推播通知設定', timeoutMs: PUSH_TOKEN_TIMEOUT_MS },
  );
}

async function deletePushToken(messaging: Messaging) {
  return withRequestTimeout(
    () => deleteToken(messaging),
    { label: '關閉推播通知', timeoutMs: PUSH_TOKEN_TIMEOUT_MS },
  );
}

async function resolveCurrentToken() {
  const messaging = await resolveMessaging();
  if (!messaging || permission.value !== 'granted') return '';
  currentToken ||= await getPushToken(messaging);
  return currentToken;
}

function applyPreference(preference: Awaited<ReturnType<typeof getPushNotificationPreference>>) {
  deviceEnabled.value = preference.deviceEnabled;
  permission.value = supported.value ? browserPermission() : preference.permission;
  personalPreferences.value = preference.personalPreferences;
}

export function usePushNotifications() {
  const { user } = useSession();
  const { showToast } = useToast();
  const deviceId = readOrCreatePushDeviceId();
  const requiresPwaInstall = computed(() =>
    shouldInstallPwaBeforePush(navigator.userAgent, navigator.platform, navigator.maxTouchPoints),
  );

  async function refreshPushPreference() {
    if (!user.value) {
      deviceEnabled.value = false;
      initialized.value = true;
      return;
    }

    loading.value = true;
    error.value = '';
    try {
      await resolveMessaging();
      if (permission.value === 'granted') {
        currentToken = await resolveCurrentToken();
      }
      const preference = await getPushNotificationPreference({
        deviceId,
        permission: permission.value,
        token: currentToken || undefined,
      });
      applyPreference(preference);
      initialized.value = true;
    } catch (caught) {
      error.value = readableError(caught);
    } finally {
      loading.value = false;
    }
  }

  async function enablePushNotifications() {
    if (!user.value) {
      error.value = '請先登入後再開啟推播通知。';
      return;
    }

    if (requiresPwaInstall.value) {
      error.value = '請先將平台加入主畫面，再從主畫面開啟通知功能。';
      requestAppInstallPrompt('notifications');
      return;
    }

    loading.value = true;
    error.value = '';
    try {
      const messaging = await resolveMessaging();
      if (!messaging) {
        deviceEnabled.value = false;
        return;
      }

      const nextPermission = await Notification.requestPermission();
      permission.value = nextPermission;
      if (nextPermission !== 'granted') {
        deviceEnabled.value = false;
        if (currentToken) {
          await unregisterPushToken({ permission: nextPermission, token: currentToken });
        }
        return;
      }

      currentToken = await getPushToken(messaging);

      if (!currentToken) {
        throw new Error('無法取得此裝置的推播識別，請稍後再試。');
      }

      const preference = await registerPushToken({
        deviceId,
        token: currentToken,
        permission: nextPermission,
        platform: navigator.platform,
        userAgent: navigator.userAgent,
      });
      applyPreference(preference);

      if (!foregroundUnsubscribe) {
        foregroundUnsubscribe = onMessage(messaging, (payload) => {
          const title = payload.data?.title ?? '收到新通知';
          const body = payload.data?.body ?? '';
          showToast(body ? `${title}：${body}` : title, 'info');
        });
      }
    } catch (caught) {
      error.value = readableError(caught);
      deviceEnabled.value = false;
    } finally {
      loading.value = false;
      initialized.value = true;
    }
  }

  async function disablePushNotifications() {
    loading.value = true;
    error.value = '';
    try {
      const messaging = await resolveMessaging();
      let tokenToDisable = currentToken;
      if (messaging) {
        try {
          tokenToDisable ||= await getPushToken(messaging);
          await deletePushToken(messaging);
        } catch {
          // Keep tokenToDisable if it was already known so the server can disable it.
        }
      }
      const preference = await unregisterPushToken({
        deviceId,
        permission: permission.value,
        token: tokenToDisable || undefined,
      });
      currentToken = '';
      applyPreference(preference);
    } catch (caught) {
      error.value = readableError(caught);
    } finally {
      loading.value = false;
      initialized.value = true;
    }
  }

  watch(user, (nextUser, previousUser) => {
    if (nextUser?.uid === previousUser?.uid) return;
    currentToken = '';
    deviceEnabled.value = false;
    error.value = '';
    initialized.value = false;
    personalPreferences.value = { comments: true, issueUpdates: true };
    permission.value = typeof window === 'undefined' ? 'default' : browserPermission();
  });

  async function setPersonalPushPreference(key: PersonalPushPreferenceKey, value: boolean) {
    loading.value = true;
    error.value = '';
    const previous = personalPreferences.value;
    personalPreferences.value = {
      ...previous,
      [key]: value,
    };
    try {
      if (permission.value === 'granted') {
        currentToken = await resolveCurrentToken();
      }
      const preference = await updatePushNotificationPreferences({
        deviceId,
        permission: permission.value,
        preferences: { [key]: value },
        token: currentToken || undefined,
      });
      applyPreference(preference);
    } catch (caught) {
      personalPreferences.value = previous;
      error.value = readableError(caught);
    } finally {
      loading.value = false;
      initialized.value = true;
    }
  }

  return {
    enabled: readonly(deviceEnabled),
    error: readonly(error),
    initialized: readonly(initialized),
    loading: readonly(loading),
    personalPreferences: readonly(personalPreferences),
    permission: readonly(permission),
    requiresPwaInstall: readonly(requiresPwaInstall),
    supported: readonly(supported),
    statusLabel: computed(() => {
      if (requiresPwaInstall.value) return '需先加入主畫面';
      if (!supported.value) return '此裝置暫不支援推播通知';
      if (permission.value === 'denied') return '瀏覽器已封鎖推播通知';
      if (deviceEnabled.value) return '此裝置推播已開啟';
      return '可開啟推播通知';
    }),
    disablePushNotifications,
    enablePushNotifications,
    refreshPushPreference,
    setPersonalPushPreference,
  };
}
