import { ref, watch } from 'vue';
import { useAppResume } from '@/composables/useAppResume';
import { usePushNotifications } from '@/composables/usePushNotifications';
import { useSession } from '@/composables/useSession';
import { requestAppInstallPrompt } from '@/lib/pwa-install';

export type PushPermissionPromptMode = 'permission' | 'repair';
type PushPromptReason = PushPermissionPromptMode | 'install';

const PUSH_PROMPT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1_000;
const PUSH_REPAIR_PROMPT_COOLDOWN_MS = 24 * 60 * 60 * 1_000;
const PUSH_PREFERENCE_REFRESH_MS = 15 * 60 * 1_000;
const PUSH_PROMPT_STORAGE_PREFIXES: Record<PushPromptReason, string> = {
  install: 'srp:push-install-prompted-at:',
  permission: 'srp:push-permission-prompted:',
  repair: 'srp:push-registration-repair-prompted-at:',
};

function pushPromptStorageKey(uid: string, reason: PushPromptReason) {
  return `${PUSH_PROMPT_STORAGE_PREFIXES[reason]}${uid}`;
}

function wasPushPromptedRecently(uid: string, reason: PushPromptReason) {
  const promptedAt = Number.parseInt(localStorage.getItem(pushPromptStorageKey(uid, reason)) || '0', 10);
  const cooldown = reason === 'repair' ? PUSH_REPAIR_PROMPT_COOLDOWN_MS : PUSH_PROMPT_COOLDOWN_MS;
  return Number.isFinite(promptedAt) && Date.now() - promptedAt < cooldown;
}

function markPushPromptSeen(uid: string, reason: PushPromptReason) {
  localStorage.setItem(pushPromptStorageKey(uid, reason), String(Date.now()));
}

export function usePushPermissionPrompt() {
  const { user } = useSession();
  const {
    enablePushNotifications,
    enabled,
    loading,
    needsRegistrationRepair,
    permission,
    requiresPwaInstall,
    refreshPushPreference,
    supported,
  } = usePushNotifications();
  const open = ref(false);
  const mode = ref<PushPermissionPromptMode>('permission');
  let checkSerial = 0;
  let lastCheckedAt = 0;

  function dismiss() {
    const uid = user.value?.uid;
    if (uid) markPushPromptSeen(uid, mode.value);
    open.value = false;
  }

  async function enable() {
    const uid = user.value?.uid;
    await enablePushNotifications();
    if (uid && (enabled.value || permission.value === 'denied')) {
      markPushPromptSeen(uid, mode.value);
    }
    open.value = false;
  }

  async function check(uid: string) {
    const currentCheck = ++checkSerial;
    await refreshPushPreference();
    lastCheckedAt = Date.now();
    if (currentCheck !== checkSerial || user.value?.uid !== uid || !supported.value) return;
    if (
      requiresPwaInstall.value
      && permission.value !== 'denied'
      && !wasPushPromptedRecently(uid, 'install')
    ) {
      markPushPromptSeen(uid, 'install');
      requestAppInstallPrompt('notifications');
      return;
    }
    if (
      !requiresPwaInstall.value
      && needsRegistrationRepair.value
      && !wasPushPromptedRecently(uid, 'repair')
    ) {
      mode.value = 'repair';
      open.value = true;
      return;
    }
    if (
      !requiresPwaInstall.value
      && !enabled.value
      && permission.value === 'default'
      && !wasPushPromptedRecently(uid, 'permission')
    ) {
      mode.value = 'permission';
      open.value = true;
    }
  }

  watch(
    () => user.value?.uid ?? '',
    (uid) => {
      checkSerial += 1;
      open.value = false;
      if (uid) void check(uid);
    },
    { immediate: true },
  );

  useAppResume(() => {
    const uid = user.value?.uid ?? '';
    if (!uid || open.value) return;
    if (Date.now() - lastCheckedAt < PUSH_PREFERENCE_REFRESH_MS) return;
    return check(uid);
  });

  return {
    busy: loading,
    dismiss,
    enable,
    mode,
    open,
  };
}
