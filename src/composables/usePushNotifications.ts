import { computed, readonly, ref, watch } from 'vue';
import { firebaseVapidKey } from '@/lib/firebase';
import { loadFirebaseMessaging } from '@/lib/firebase-messaging';
import { ensureFirebaseAppCheck } from '@/lib/firebase-app-check';
import { requestAppInstallPrompt, shouldInstallPwaBeforePush } from '@/lib/pwa-install';
import { withRequestTimeout } from '@/lib/request';
import { useSession } from '@/composables/useSession';
import { useActionFeedback } from '@/composables/useActionFeedback';
import { readLocalStorage, removeLocalStorage, writeLocalStorage } from '@/lib/browser-storage';
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
const PUSH_DEVICE_ID_STORAGE_KEY = 'novae:push-device-id';
const PUSH_EXPLICITLY_DISABLED_STORAGE_PREFIX = 'novae:push-explicitly-disabled:';
const PUSH_REGISTRATION_SYNC_STORAGE_PREFIX = 'novae:push-registration-sync:';
const PUSH_REGISTRATION_SYNC_TTL_MS = 7 * 24 * 60 * 60_000;
const supported = ref(false);
const permission = ref<PushNotificationPermission>('default');
const deviceEnabled = ref(false);
const explicitlyDisabled = ref(false);
const loading = ref(false);
const error = ref('');
const initialized = ref(false);
const personalPreferences = ref<PersonalPushPreferences>({
  comments: true,
  issueUpdates: true,
  facilityUpdates: true,
});
let currentToken = '';
let volatileDeviceId = '';
let foregroundUnsubscribe: (() => void) | null = null;
let synchronizedRegistrationKey = '';

function readOrCreatePushDeviceId() {
  if (typeof window === 'undefined') return '';
  const existing = readLocalStorage(PUSH_DEVICE_ID_STORAGE_KEY)?.trim() || volatileDeviceId;
  if (existing) return existing;
  const nextId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `push-device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  volatileDeviceId = nextId;
  writeLocalStorage(PUSH_DEVICE_ID_STORAGE_KEY, nextId);
  return nextId;
}

function browserPermission(): PushNotificationPermission {
  if (!('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

function readableError(value: unknown) {
  return value instanceof Error ? value.message : 'notification.pushSetupFailed';
}

async function resolveMessaging() {
  if (!firebaseVapidKey) {
    supported.value = false;
    permission.value = 'unsupported';
    return null;
  }

  await ensureFirebaseAppCheck();
  const bundle = await loadFirebaseMessaging();
  supported.value = Boolean(bundle) && 'Notification' in window && 'serviceWorker' in navigator;
  if (!supported.value) {
    permission.value = 'unsupported';
    return null;
  }
  permission.value = browserPermission();
  return bundle;
}

async function waitForPushServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    throw new Error('notification.pushUnavailable');
  }

  return withRequestTimeout(
    () => navigator.serviceWorker.ready,
    { label: 'notification.pushServiceStarted', timeoutMs: PUSH_SERVICE_TIMEOUT_MS },
  );
}

async function getPushToken(bundle: NonNullable<Awaited<ReturnType<typeof loadFirebaseMessaging>>>) {
  const registration = await waitForPushServiceWorker();
  return withRequestTimeout(
    () => bundle.sdk.getToken(bundle.messaging, {
      vapidKey: firebaseVapidKey,
      serviceWorkerRegistration: registration,
    }),
    { label: 'notification.pushNotificationSettings', timeoutMs: PUSH_TOKEN_TIMEOUT_MS },
  );
}

async function deletePushToken(bundle: NonNullable<Awaited<ReturnType<typeof loadFirebaseMessaging>>>) {
  return withRequestTimeout(
    () => bundle.sdk.deleteToken(bundle.messaging),
    { label: 'notification.turnOffPushNotifications', timeoutMs: PUSH_TOKEN_TIMEOUT_MS },
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
  const { show } = useActionFeedback();
  const deviceId = readOrCreatePushDeviceId();
  const requiresPwaInstall = computed(() =>
    shouldInstallPwaBeforePush(navigator.userAgent, navigator.platform, navigator.maxTouchPoints),
  );
  const needsRegistrationRepair = computed(() =>
    supported.value
    && permission.value === 'granted'
    && !deviceEnabled.value
    && !explicitlyDisabled.value,
  );

  function explicitlyDisabledStorageKey(uid: string) {
    return `${PUSH_EXPLICITLY_DISABLED_STORAGE_PREFIX}${uid}:${deviceId}`;
  }

  function registrationSyncStorageKey(uid: string) {
    return `${PUSH_REGISTRATION_SYNC_STORAGE_PREFIX}${uid}:${deviceId}`;
  }

  function registrationIsFresh(uid: string) {
    const synchronizedAt = Number(readLocalStorage(registrationSyncStorageKey(uid)) ?? 0);
    return Number.isFinite(synchronizedAt) && Date.now() - synchronizedAt < PUSH_REGISTRATION_SYNC_TTL_MS;
  }

  function markRegistrationSynchronized(uid: string) {
    if (uid) writeLocalStorage(registrationSyncStorageKey(uid), String(Date.now()));
  }

  function clearRegistrationSynchronization(uid: string) {
    if (uid) removeLocalStorage(registrationSyncStorageKey(uid));
  }

  function readExplicitlyDisabled(uid: string) {
    return Boolean(uid && readLocalStorage(explicitlyDisabledStorageKey(uid)) === '1');
  }

  function setExplicitlyDisabled(disabled: boolean) {
    const uid = user.value?.uid ?? '';
    explicitlyDisabled.value = disabled;
    if (!uid) return;
    const storageKey = explicitlyDisabledStorageKey(uid);
    if (disabled) writeLocalStorage(storageKey, '1');
    else removeLocalStorage(storageKey);
  }

  async function registerCurrentPushToken(token: string) {
    return registerPushToken({
      deviceId,
      token,
      permission: 'granted',
      platform: navigator.platform,
      userAgent: navigator.userAgent,
    });
  }

  explicitlyDisabled.value = readExplicitlyDisabled(user.value?.uid ?? '');

  async function refreshPushPreference() {
    if (!user.value) {
      deviceEnabled.value = false;
      initialized.value = true;
      return;
    }

    loading.value = true;
    error.value = '';
    try {
      supported.value = Boolean(firebaseVapidKey && 'Notification' in window && 'serviceWorker' in navigator);
      permission.value = supported.value ? browserPermission() : 'unsupported';
      const preference = await getPushNotificationPreference({
        deviceId,
        permission: permission.value,
      });
      applyPreference(preference);

      const uid = user.value.uid;
      if (
        permission.value === 'granted'
        && preference.deviceEnabled
        && !explicitlyDisabled.value
        && !registrationIsFresh(uid)
      ) {
        const messaging = await resolveMessaging();
        currentToken = messaging ? await getPushToken(messaging) : '';
        if (!currentToken) throw new Error('notification.pushTokenUnavailable');
        const registrationKey = `${user.value.uid}:${currentToken}`;
        if (synchronizedRegistrationKey !== registrationKey) {
          const synchronizedPreference = await registerCurrentPushToken(currentToken);
          synchronizedRegistrationKey = registrationKey;
          markRegistrationSynchronized(uid);
          setExplicitlyDisabled(false);
          applyPreference(synchronizedPreference);
        }
      }

      if (permission.value !== 'granted' && preference.deviceEnabled) {
        const cleaned = await unregisterPushToken({
          deviceId,
          permission: permission.value,
          token: currentToken || undefined,
        });
        applyPreference(cleaned);
      }

      initialized.value = true;
    } catch (caught) {
      error.value = readableError(caught);
    } finally {
      loading.value = false;
    }
  }

  async function enablePushNotifications() {
    if (!user.value) {
      error.value = 'notification.signInRequired';
      return false;
    }

    if (requiresPwaInstall.value) {
      error.value = 'app.install.enableNotificationsAfterInstall';
      requestAppInstallPrompt('notifications');
      return false;
    }

    loading.value = true;
    error.value = '';
    try {
      const messaging = await resolveMessaging();
      if (!messaging) {
        deviceEnabled.value = false;
        return false;
      }

      const nextPermission = await Notification.requestPermission();
      permission.value = nextPermission;
      if (nextPermission !== 'granted') {
        deviceEnabled.value = false;
        if (currentToken) {
          await unregisterPushToken({ deviceId, permission: nextPermission, token: currentToken });
        }
        return false;
      }

      currentToken = await getPushToken(messaging);

      if (!currentToken) {
        throw new Error('notification.pushTokenUnavailable');
      }

      const preference = await registerCurrentPushToken(currentToken);
      synchronizedRegistrationKey = `${user.value.uid}:${currentToken}`;
      markRegistrationSynchronized(user.value.uid);
      setExplicitlyDisabled(false);
      applyPreference(preference);

      if (!foregroundUnsubscribe) {
        foregroundUnsubscribe = messaging.sdk.onMessage(messaging.messaging, (payload) => {
          const title = payload.data?.title ?? 'notification.newNotificationReceived';
          const body = payload.data?.body ?? '';
          show(body ? `${title}：${body}` : title, 'info');
        });
      }
      return true;
    } catch (caught) {
      error.value = readableError(caught);
      deviceEnabled.value = false;
      return false;
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
      synchronizedRegistrationKey = '';
      clearRegistrationSynchronization(user.value?.uid ?? '');
      setExplicitlyDisabled(true);
      applyPreference(preference);
      return true;
    } catch (caught) {
      error.value = readableError(caught);
      return false;
    } finally {
      loading.value = false;
      initialized.value = true;
    }
  }

  watch(user, (nextUser, previousUser) => {
    if (nextUser?.uid === previousUser?.uid) return;
    currentToken = '';
    synchronizedRegistrationKey = '';
    deviceEnabled.value = false;
    explicitlyDisabled.value = readExplicitlyDisabled(nextUser?.uid ?? '');
    error.value = '';
    initialized.value = false;
    personalPreferences.value = { comments: true, facilityUpdates: true, issueUpdates: true };
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
      return true;
    } catch (caught) {
      personalPreferences.value = previous;
      error.value = readableError(caught);
      return false;
    } finally {
      loading.value = false;
      initialized.value = true;
    }
  }

  return {
    enabled: computed(() => deviceEnabled.value && permission.value === 'granted'),
    error: readonly(error),
    initialized: readonly(initialized),
    loading: readonly(loading),
    needsRegistrationRepair: readonly(needsRegistrationRepair),
    personalPreferences: readonly(personalPreferences),
    permission: readonly(permission),
    requiresPwaInstall: readonly(requiresPwaInstall),
    supported: readonly(supported),
    statusLabel: computed(() => {
      if (requiresPwaInstall.value) return 'app.install.addToHomeScreenFirst';
      if (!supported.value) return 'notification.pushDeviceUnsupported';
      if (permission.value === 'denied') return 'notification.theBrowserHasBlockedPushNotifications';
      if (deviceEnabled.value) return 'notification.pushNotificationIsEnabledForThisDevice';
      return 'notification.pushNotificationsCanBeTurnedOn';
    }),
    disablePushNotifications,
    enablePushNotifications,
    refreshPushPreference,
    setPersonalPushPreference,
  };
}
