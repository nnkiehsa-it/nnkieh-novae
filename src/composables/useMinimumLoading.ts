import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue';

interface MinimumLoadingOptions {
  minMs?: number;
  trigger?: Ref<unknown>;
}

const DEFAULT_MIN_MS = 300;

export function useMinimumLoading(
  loading: Ref<boolean>,
  options: MinimumLoadingOptions = {},
) {
  const minMs = options.minMs ?? DEFAULT_MIN_MS;
  const visibleLoading = ref(loading.value);
  let shownAt = loading.value ? Date.now() : 0;
  let hideTimer: ReturnType<typeof setTimeout> | null = null;

  function clearHideTimer() {
    if (hideTimer !== null) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  watch(
    loading,
    (isLoading) => {
      clearHideTimer();

      if (isLoading) {
        shownAt = Date.now();
        visibleLoading.value = true;
        return;
      }

      if (!visibleLoading.value) {
        return;
      }

      const elapsed = Date.now() - shownAt;
      const remaining = Math.max(0, minMs - elapsed);
      if (remaining === 0) {
        visibleLoading.value = false;
        return;
      }

      hideTimer = setTimeout(() => {
        visibleLoading.value = false;
        hideTimer = null;
      }, remaining);
    },
    { immediate: true },
  );

  if (options.trigger) {
    watch(options.trigger, () => {
      // Keep trigger in the dependency surface for call sites that pass list keys.
      // Minimum display time is driven solely by `loading`.
    });
  }

  onBeforeUnmount(() => {
    clearHideTimer();
  });

  return {
    visibleLoading: computed(() => visibleLoading.value),
  };
}
