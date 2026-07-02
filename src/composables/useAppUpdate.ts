import { readonly, ref } from 'vue';
import { safeFetch, withRequestTimeout } from '@/lib/request';
import { resetAppConnection } from '@/lib/reconnect';

const updateAvailable = ref(false);
const checking = ref(false);
let lastCheckedAt = 0;

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
      timeoutMs: 8_000,
    });

    const data = await response.json() as VersionResponse;
    const remoteVersion = typeof data.version === 'string' ? data.version : '';
    updateAvailable.value = Boolean(
      remoteVersion
      && remoteVersion !== __APP_VERSION__,
    );
  } catch {
    return;
  } finally {
    checking.value = false;
  }
}

async function updateServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  try {
    const registration = await withRequestTimeout(
      () => navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none',
      }),
      { label: 'Service Worker 註冊' },
    );
    await withRequestTimeout(() => navigator.serviceWorker.ready, { label: 'Service Worker 啟動' });
    await withRequestTimeout(() => registration.update(), { label: 'Service Worker 更新' });
  } catch {
    return;
  }
}

export async function initializeAppUpdate() {
  await checkAppVersion();
  void updateServiceWorker();
}

export function useAppUpdate() {
  async function reloadApp() {
    await resetAppConnection();
    window.location.reload();
  }

  return {
    checking: readonly(checking),
    reloadApp,
    updateAvailable: readonly(updateAvailable),
  };
}
