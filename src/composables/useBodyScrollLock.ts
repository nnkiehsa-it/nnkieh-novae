import { onBeforeUnmount, watch, type Ref } from 'vue';

let lockCount = 0;
let previousBodyStyle = '';
let previousHtmlStyle = '';
let savedScrollY = 0;

function isIosStandalonePwa() {
  if (typeof window === 'undefined') return false;

  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  const isStandalone = navigatorWithStandalone.standalone === true
    || window.matchMedia('(display-mode: standalone)').matches;
  const isIos = /iP(ad|hone|od)/.test(window.navigator.userAgent)
    || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);

  return isStandalone && isIos;
}

function syncBodyScrollLock() {
  if (typeof document === 'undefined') {
    return;
  }

  if (lockCount > 0) {
    document.documentElement.classList.add('dialog-open');
    document.body.classList.add('dialog-open');
    document.body.style.cssText = previousBodyStyle;
    document.documentElement.style.cssText = previousHtmlStyle;
    document.body.style.position = 'fixed';
    document.body.style.top = isIosStandalonePwa() ? '0' : `-${savedScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.documentElement.style.overscrollBehavior = 'none';
    return;
  }

  document.documentElement.classList.remove('dialog-open');
  document.body.classList.remove('dialog-open');
  document.body.style.cssText = previousBodyStyle;
  document.documentElement.style.cssText = previousHtmlStyle;

  if (savedScrollY > 0) {
    const targetY = savedScrollY;
    savedScrollY = 0; // Reset immediately so stale state can't cause future jumps
    window.scrollTo(0, targetY);
  }
}

function lockBodyScroll() {
  if (typeof document === 'undefined') {
    return;
  }

  if (lockCount === 0) {
    previousBodyStyle = document.body.style.cssText;
    previousHtmlStyle = document.documentElement.style.cssText;
    savedScrollY = window.scrollY || window.pageYOffset;
  }

  lockCount += 1;
  syncBodyScrollLock();
}

function unlockBodyScroll() {
  if (typeof document === 'undefined' || lockCount === 0) {
    return;
  }

  lockCount -= 1;
  syncBodyScrollLock();
}

export function useBodyScrollLock(open: Ref<boolean>) {
  let isLocked = false;

  watch(
    open,
    (nextOpen) => {
      if (nextOpen && !isLocked) {
        lockBodyScroll();
        isLocked = true;
        return;
      }

      if (!nextOpen && isLocked) {
        unlockBodyScroll();
        isLocked = false;
      }
    },
    { immediate: true },
  );

  onBeforeUnmount(() => {
    if (!isLocked) {
      return;
    }

    unlockBodyScroll();
    isLocked = false;
  });
}
