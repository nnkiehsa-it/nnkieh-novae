import { computed, onMounted, onScopeDispose, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useSession } from '@/composables/useSession';
import { useAppUpdate } from '@/composables/useAppUpdate';

const APP_STARTUP_TIMEOUT_MS = 20_000;

export function useAppStartupGate() {
  const router = useRouter();
  const { appReady, authChecking, userLoading, appInitializing } = useSession();
  const routerReady = ref(false);
  const routerFailed = ref(false);
  const timedOut = ref(false);
  let startupTimeout = 0;

  const open = computed(() =>
    !routerReady.value
    || !appReady.value
    || authChecking.value
    || userLoading.value
    || appInitializing.value
  );

  function clearStartupTimeout() {
    window.clearTimeout(startupTimeout);
    startupTimeout = 0;
  }

  onMounted(() => {
    void router.isReady()
      .then(() => {
        routerReady.value = true;
      })
      .catch(() => {
        routerFailed.value = true;
      });
  });

  watch(open, (isOpen) => {
    clearStartupTimeout();
    timedOut.value = false;
    if (isOpen) {
      startupTimeout = window.setTimeout(() => {
        timedOut.value = true;
      }, APP_STARTUP_TIMEOUT_MS);
    }
  }, { immediate: true });

  onScopeDispose(clearStartupTimeout);

  return {
    open,
    stalled: computed(() => open.value && (routerFailed.value || timedOut.value)),
  };
}
