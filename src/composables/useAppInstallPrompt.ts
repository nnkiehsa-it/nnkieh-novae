import { computed, onBeforeUnmount, ref, shallowRef } from 'vue';
import { detectInAppBrowser, type InAppBrowserName } from '@/lib/in-app-browser';
import {
  REQUEST_APP_INSTALL_PROMPT_EVENT,
  detectIosBrowserGuide,
  isAndroidDevice,
  isIosSafari,
  isStandaloneMode,
  isTouchPrimaryDevice,
  type AppInstallPromptReason,
  type IosBrowserGuide,
} from '@/lib/pwa-install';

export type AppInstallPromptMode = 'in-app-browser' | 'native-install' | 'ios-install' | 'ios-open-safari';

const DISMISSED_KEY = 'srp-app-install-prompt-dismissed';

function hasDismissedPrompt() {
  try {
    return sessionStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

function rememberDismissedPrompt() {
  try {
    sessionStorage.setItem(DISMISSED_KEY, '1');
  } catch {
    return;
  }
}

export function useAppInstallPrompt() {
  const isAndroid = isAndroidDevice(navigator.userAgent);
  const inAppBrowserName = detectInAppBrowser(navigator.userAgent);
  const iosBrowserGuide = detectIosBrowserGuide(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);
  const deferredPrompt = shallowRef<BeforeInstallPromptEvent | null>(null);
  const dismissed = ref(hasDismissedPrompt());
  const isPrompting = ref(false);
  const reason = ref<AppInstallPromptReason>('default');

  const mode = computed<AppInstallPromptMode | null>(() => {
    if ((dismissed.value && reason.value === 'default') || isStandaloneMode()) return null;
    if (iosBrowserGuide) return 'ios-open-safari';
    if (inAppBrowserName) return 'in-app-browser';
    if (isAndroid || (deferredPrompt.value && isTouchPrimaryDevice())) return 'native-install';
    if (isIosSafari(navigator.userAgent, navigator.platform, navigator.maxTouchPoints)) return 'ios-install';
    return null;
  });

  const open = computed(() => mode.value !== null);
  const canInstallNatively = computed(() => deferredPrompt.value !== null);

  function dismiss() {
    dismissed.value = true;
    reason.value = 'default';
    rememberDismissedPrompt();
  }

  async function promptInstall() {
    if (!deferredPrompt.value || isPrompting.value) return;

    const promptEvent = deferredPrompt.value;
    deferredPrompt.value = null;
    isPrompting.value = true;

    try {
      await promptEvent.prompt();
      await promptEvent.userChoice.catch(() => null);
    } finally {
      isPrompting.value = false;
      dismiss();
    }
  }

  async function copyInstallUrl() {
    if (isPrompting.value) return;

    isPrompting.value = true;

    try {
      await navigator.clipboard?.writeText(window.location.href);
    } finally {
      isPrompting.value = false;
    }
  }

  function handleBeforeInstallPrompt(event: Event) {
    if (isStandaloneMode()) return;
    event.preventDefault();
    deferredPrompt.value = event as BeforeInstallPromptEvent;
  }

  function handleAppInstalled() {
    deferredPrompt.value = null;
    dismiss();
  }

  function handleInstallPromptRequest(event: Event) {
    const requestedReason = (event as CustomEvent<{ reason?: AppInstallPromptReason }>).detail?.reason;
    reason.value = requestedReason === 'notifications' ? 'notifications' : 'default';
    dismissed.value = false;
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener(REQUEST_APP_INSTALL_PROMPT_EVENT, handleInstallPromptRequest);
  }

  onBeforeUnmount(() => {
    window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.removeEventListener('appinstalled', handleAppInstalled);
    window.removeEventListener(REQUEST_APP_INSTALL_PROMPT_EVENT, handleInstallPromptRequest);
  });

  return {
    browserName: inAppBrowserName as InAppBrowserName | null,
    canInstallNatively,
    iosBrowserGuide: iosBrowserGuide as IosBrowserGuide | null,
    isPrompting,
    mode,
    open,
    copyInstallUrl,
    dismiss,
    promptInstall,
    reason,
  };
}
