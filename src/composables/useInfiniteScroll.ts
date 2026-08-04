import { nextTick, onBeforeUnmount, ref, watch, type Ref } from 'vue';

interface InfiniteScrollOptions {
  disabled?: Ref<boolean>;
  loading?: Ref<boolean>;
  onLoadMore: () => void | Promise<void>;
  root?: Ref<HTMLElement | null>;
  rootMargin?: string;
}

export function useInfiniteScroll(options: InfiniteScrollOptions) {
  const sentinel = ref<HTMLElement | null>(null);
  let observer: IntersectionObserver | null = null;
  let loadPending = false;
  let disposed = false;
  let scrollGateRoot: HTMLElement | null = null;
  let scrollGateTop = 0;
  let lastTouchY: number | null = null;
  let syncVersion = 0;

  function preventForwardWheel(event: WheelEvent) {
    if (event.deltaY > 0 && scrollGateRoot && scrollGateRoot.scrollTop >= scrollGateTop) {
      event.preventDefault();
    }
  }

  function rememberTouchPosition(event: TouchEvent) {
    lastTouchY = event.touches[0]?.clientY ?? null;
  }

  function preventForwardTouch(event: TouchEvent) {
    const currentTouchY = event.touches[0]?.clientY;
    if (currentTouchY === undefined) return;
    const movingForward = lastTouchY !== null && currentTouchY < lastTouchY;
    lastTouchY = currentTouchY;
    if (movingForward && scrollGateRoot && scrollGateRoot.scrollTop >= scrollGateTop) {
      event.preventDefault();
    }
  }

  function clampForwardScroll() {
    if (scrollGateRoot && scrollGateRoot.scrollTop > scrollGateTop) {
      scrollGateRoot.scrollTop = scrollGateTop;
    }
  }

  function releaseScrollGate() {
    if (!scrollGateRoot) return;
    scrollGateRoot.classList.remove('load-more-scroll-gate');
    scrollGateRoot.removeEventListener('wheel', preventForwardWheel);
    scrollGateRoot.removeEventListener('touchstart', rememberTouchPosition);
    scrollGateRoot.removeEventListener('touchmove', preventForwardTouch);
    scrollGateRoot.removeEventListener('scroll', clampForwardScroll);
    scrollGateRoot = null;
    scrollGateTop = 0;
    lastTouchY = null;
  }

  function activateScrollGate(root: HTMLElement) {
    scrollGateRoot = root;
    scrollGateTop = root.scrollTop;
    root.classList.add('load-more-scroll-gate');
    root.addEventListener('wheel', preventForwardWheel, { passive: false });
    root.addEventListener('touchstart', rememberTouchPosition, { passive: true });
    root.addEventListener('touchmove', preventForwardTouch, { passive: false });
    root.addEventListener('scroll', clampForwardScroll, { passive: true });
  }

  function findScrollRoot(element: HTMLElement | null) {
    let current = element?.parentElement ?? null;
    while (current) {
      const overflowY = window.getComputedStyle(current).overflowY;
      if (overflowY === 'auto' || overflowY === 'scroll') return current;
      current = current.parentElement;
    }
    return null;
  }

  function stopObserver() {
    observer?.disconnect();
    observer = null;
  }

  async function triggerLoadMore() {
    if (loadPending || options.disabled?.value) return;
    loadPending = true;
    try {
      await options.onLoadMore();
    } finally {
      loadPending = false;
      await nextTick();
      if (!disposed && !options.disabled?.value) {
        const element = sentinel.value;
        startObserver(element, options.root?.value ?? findScrollRoot(element));
      }
    }
  }

  function startObserver(element: HTMLElement | null, root: HTMLElement | null) {
    stopObserver();
    if (!element) return;

    observer = new IntersectionObserver((entries) => {
      if (options.disabled?.value) return;
      if (entries.some((entry) => entry.isIntersecting)) {
        void triggerLoadMore();
      }
    }, {
      root,
      rootMargin: options.rootMargin ?? '360px 0px',
    });
    observer.observe(element);
  }

  watch(
    [
      sentinel,
      () => options.root?.value ?? null,
      () => options.disabled?.value ?? false,
      () => options.loading?.value ?? false,
    ],
    async ([element, explicitRoot, disabled, loading]) => {
      const currentSyncVersion = ++syncVersion;
      stopObserver();
      releaseScrollGate();
      await nextTick();
      if (disposed || currentSyncVersion !== syncVersion) return;
      const resolvedElement = element as HTMLElement | null;
      const root = (explicitRoot as HTMLElement | null) ?? findScrollRoot(resolvedElement);
      if (loading && root) activateScrollGate(root);
      if (disabled) return;
      startObserver(resolvedElement, root);
    },
    { flush: 'post', immediate: true },
  );
  onBeforeUnmount(() => {
    disposed = true;
    syncVersion += 1;
    stopObserver();
    releaseScrollGate();
  });

  return {
    sentinel,
  };
}
