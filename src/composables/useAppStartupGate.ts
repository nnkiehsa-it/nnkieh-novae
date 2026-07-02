import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useSession } from '@/composables/useSession';

const MINIMUM_STARTUP_DURATION_MS = 1000;

export function useAppStartupGate() {
  const router = useRouter();
  const { appReady, authChecking, userLoading, appInitializing } = useSession();
  const minimumDurationDone = ref(false);
  const routerReady = ref(false);

  onMounted(() => {
    window.setTimeout(() => {
      minimumDurationDone.value = true;
    }, MINIMUM_STARTUP_DURATION_MS);

    void router.isReady().then(() => {
      routerReady.value = true;
    });
  });

  const open = computed(() =>
    !minimumDurationDone.value
    || !routerReady.value
    || !appReady.value
    || authChecking.value
    || userLoading.value
    || appInitializing.value
  );

  return {
    open,
  };
}
