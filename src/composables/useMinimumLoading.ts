import { onBeforeUnmount, ref, watch, type Ref } from 'vue';

const DEFAULT_MINIMUM_LOADING_MS = 150;

interface MinimumLoadingOptions {
  minimumMs?: number;
  trigger?: Ref<unknown>;
}

export function useMinimumLoading(
  loading: Ref<boolean>,
  options: MinimumLoadingOptions = {},
) {
  const minimumMs = options.minimumMs ?? DEFAULT_MINIMUM_LOADING_MS;
  const visibleLoading = ref(loading.value);
  let visibleSince = loading.value ? Date.now() : 0;
  let hideTimer: number | null = null;

  function clearHideTimer() {
    if (hideTimer === null) return;
    window.clearTimeout(hideTimer);
    hideTimer = null;
  }

  function showLoading() {
    clearHideTimer();
    visibleLoading.value = true;
    visibleSince = Date.now();
  }

  function hideWhenReady() {
    clearHideTimer();
    if (loading.value) return;

    const remainingMs = Math.max(0, minimumMs - (Date.now() - visibleSince));
    hideTimer = window.setTimeout(() => {
      if (!loading.value) visibleLoading.value = false;
      hideTimer = null;
    }, remainingMs);
  }

  watch(loading, (isLoading) => {
    if (isLoading) {
      showLoading();
      return;
    }
    hideWhenReady();
  });

  if (options.trigger) {
    watch(options.trigger, (nextValue, previousValue) => {
      if (previousValue === undefined || nextValue === previousValue) return;
      if (!visibleLoading.value) showLoading();
      hideWhenReady();
    });
  }

  onBeforeUnmount(clearHideTimer);

  return {
    visibleLoading,
  };
}
