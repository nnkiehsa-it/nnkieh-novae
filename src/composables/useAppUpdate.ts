import { readonly, ref } from 'vue';
import { safeFetch, withRequestTimeout } from '@/lib/request';
import { resetAppConnection } from '@/lib/reconnect';

const updateAvailable = ref(false);
const checking = ref(false);
const reloading = ref<false | 'update' | 'restart'>(false);
const remoteVersion = ref('');
const initialCheckDone = ref(false);
let lastCheckedAt = 0;
let listenersRegistered = false;

const APP_RELOAD_TIMEOUT_MS = 5_000;
const SERVICE_WORKER_PREPARE_TIMEOUT_MS = 4_000;
const RELOAD_NAVIGATION_RETRY_MS = 4_000;
const RELOAD_RECOVERY_TIMEOUT_MS = 10_000;
const MAX_AUTO_RELOAD_ATTEMPTS = 3;
const AUTO_RELOAD_STORAGE_KEY = 'novae:auto-update-reloaded-version';
const AUTO_RELOAD_COUNT_KEY = 'novae:auto-update-reloaded-count';
const PENDING_UPDATE_VERSION_STORAGE_KEY = 'novae:pending-update-version';

interface VersionResponse {
  version?: string;
}

async function checkAppVersion() {
  if (checking.value || Date.now() - lastCheckedAt < 60_000) {
    return;
  }

  checking.value = true;
  lastCheckedAt = Date.now();

  try {
    const response = await safeFetch('/version.json', { cache: 'no-store' }, {
      label: '版本檢查',
      timeoutMs: APP_RELOAD_TIMEOUT_MS,
    });

    const data = await response.json() as VersionResponse;
    const nextRemoteVersion = typeof data.version === 'string' ? data.version : '';
    remoteVersion.value = nextRemoteVersion;
    updateAvailable.value = Boolean(
      nextRemoteVersion
      && nextRemoteVersion !== __APP_VERSION__,
    );
  } catch {
    return;
  } finally {
    checking.value = false;
  }
}

function shouldCheckAfterResume() {
  return Date.now() - lastCheckedAt >= 5 * 60_000;
}

async function updateServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await withRequestTimeout(
      () => navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        type: 'module',
        updateViaCache: 'none',
      }),
      { label: 'Service Worker 註冊', timeoutMs: APP_RELOAD_TIMEOUT_MS },
    );
    await withRequestTimeout(() => navigator.serviceWorker.ready, {
      label: 'Service Worker 啟動',
      timeoutMs: APP_RELOAD_TIMEOUT_MS,
    });
    await withRequestTimeout(() => registration.update(), {
      label: 'Service Worker 更新',
      timeoutMs: APP_RELOAD_TIMEOUT_MS,
    });
    return registration;
  } catch {
    return null;
  }
}

async function waitForServiceWorkerTakeover(registration: ServiceWorkerRegistration, signal: AbortSignal) {
  const candidate = registration.waiting ?? registration.installing;
  if (!candidate) return;

  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      candidate.removeEventListener('statechange', handleStateChange);
      navigator.serviceWorker.removeEventListener('controllerchange', finish);
      signal.removeEventListener('abort', finish);
      resolve();
    };
    const handleStateChange = () => {
      if (candidate.state === 'activated' || candidate.state === 'redundant') finish();
    };

    candidate.addEventListener('statechange', handleStateChange);
    navigator.serviceWorker.addEventListener('controllerchange', finish, { once: true });
    signal.addEventListener('abort', finish, { once: true });
    registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
    handleStateChange();
  });
}

async function prepareServiceWorkerForReload() {
  try {
    await withRequestTimeout(async (signal) => {
      const registration = await updateServiceWorker();
      if (!registration || signal.aborted) return;
      await waitForServiceWorkerTakeover(registration, signal);
    }, {
      label: '新版 App 準備',
      timeoutMs: SERVICE_WORKER_PREPARE_TIMEOUT_MS,
    });
  } catch {
    // Navigation still proceeds. The reload watchdog keeps this path bounded.
  }
}

export async function initializeAppUpdate() {
  if (!listenersRegistered && typeof window !== 'undefined') {
    listenersRegistered = true;
    window.addEventListener('online', () => void checkAppVersion());
    window.addEventListener('pageshow', () => {
      if (shouldCheckAfterResume()) void checkAppVersion();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && shouldCheckAfterResume()) {
        void checkAppVersion();
      }
    });
  }

  void updateServiceWorker();
  try {
    await checkAppVersion();
  } finally {
    initialCheckDone.value = true;
  }
}

export function useAppUpdate() {
  function getAutoReloadCount() {
    const savedCount = Number.parseInt(sessionStorage.getItem(AUTO_RELOAD_COUNT_KEY) || '0', 10);
    return Number.isFinite(savedCount) && savedCount > 0 ? savedCount : 0;
  }

  function canAutoReloadCurrentVersion() {
    if (!remoteVersion.value) return false;
    const savedVersion = sessionStorage.getItem(AUTO_RELOAD_STORAGE_KEY);
    if (savedVersion !== remoteVersion.value) {
      return true;
    }
    return getAutoReloadCount() < MAX_AUTO_RELOAD_ATTEMPTS;
  }

  function markAutomaticReloadExhausted() {
    if (!remoteVersion.value) return;
    sessionStorage.setItem(AUTO_RELOAD_STORAGE_KEY, remoteVersion.value);
    sessionStorage.setItem(AUTO_RELOAD_COUNT_KEY, String(MAX_AUTO_RELOAD_ATTEMPTS));
  }

  function startReloadRecoveryWatchdog() {
    window.setTimeout(() => {
      try {
        window.location.reload();
      } catch {
        // The final timeout below restores the forced-update prompt when navigation is unavailable.
      }
    }, RELOAD_NAVIGATION_RETRY_MS);

    window.setTimeout(() => {
      if (updateAvailable.value) {
        markAutomaticReloadExhausted();
      }
      reloading.value = false;
    }, RELOAD_RECOVERY_TIMEOUT_MS);
  }

  async function reloadApp(options: { automatic?: boolean; reason?: 'update' | 'restart' } = {}) {
    if (reloading.value) {
      return;
    }

    if (options.automatic && !canAutoReloadCurrentVersion()) {
      return;
    }

    reloading.value = options.reason || 'update';

    if (options.automatic && remoteVersion.value) {
      const savedVersion = sessionStorage.getItem(AUTO_RELOAD_STORAGE_KEY);
      if (savedVersion === remoteVersion.value) {
        sessionStorage.setItem(AUTO_RELOAD_COUNT_KEY, String(getAutoReloadCount() + 1));
      } else {
        sessionStorage.setItem(AUTO_RELOAD_STORAGE_KEY, remoteVersion.value);
        sessionStorage.setItem(AUTO_RELOAD_COUNT_KEY, '1');
      }
    }

    if (remoteVersion.value) {
      localStorage.setItem(PENDING_UPDATE_VERSION_STORAGE_KEY, remoteVersion.value);
    }
    if ((options.reason ?? 'update') === 'update') {
      await prepareServiceWorkerForReload();
    }
    let reloadTimeout = 0;
    await Promise.race([
      (async () => {
        // 不再 await updateServiceWorker()，這在安卓 WebView 下很容易因 ready 屬性 pending 而卡死
        // 重載網頁後 main.ts 啟動時本來就會背景進行 SW 註冊更新
        await resetAppConnection();
      })(),
      new Promise<void>((resolve) => {
        // 設定 3 秒作為本機 reset 連線的超時安全保險絲，提供充足的弱網環境與 CPU 繁忙容錯空間
        reloadTimeout = window.setTimeout(resolve, 3000);
      }),
    ]);
    window.clearTimeout(reloadTimeout);

    startReloadRecoveryWatchdog();
    // 使用相容性極佳的 replace() 重載網頁，防止 location.reload() 被 Android WebView / LINE 等環境掛起或吞掉
    try {
      window.location.replace(window.location.href);
    } catch {
      window.location.reload();
    }
  }

  return {
    canAutoReloadCurrentVersion,
    checking: readonly(checking),
    initialCheckDone: readonly(initialCheckDone),
    reloadApp,
    reloading: readonly(reloading),
    remoteVersion: readonly(remoteVersion),
    updateAvailable: readonly(updateAvailable),
  };
}
