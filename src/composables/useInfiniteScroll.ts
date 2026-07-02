import { onBeforeUnmount, ref, watch, type Ref } from 'vue';

interface InfiniteScrollOptions {
  disabled?: Ref<boolean>;
  onLoadMore: () => void | Promise<void>;
  rootMargin?: string;
}

export function useInfiniteScroll(options: InfiniteScrollOptions) {
  const sentinel = ref<HTMLElement | null>(null);
  let observer: IntersectionObserver | null = null;

  function stopObserver() {
    observer?.disconnect();
    observer = null;
  }

  function startObserver(element: HTMLElement | null) {
    stopObserver();
    if (!element) return;

    observer = new IntersectionObserver((entries) => {
      if (options.disabled?.value) return;
      if (entries.some((entry) => entry.isIntersecting)) {
        void options.onLoadMore();
      }
    }, {
      rootMargin: options.rootMargin ?? '360px 0px',
    });
    observer.observe(element);
  }

  watch(sentinel, startObserver, { immediate: true });
  onBeforeUnmount(stopObserver);

  return {
    sentinel,
  };
}
