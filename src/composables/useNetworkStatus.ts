import { onScopeDispose, ref } from 'vue';

const isOnline = ref(typeof navigator === 'undefined' ? true : navigator.onLine);
let listenerCount = 0;
let removeListeners: (() => void) | null = null;

function setupListeners() {
  if (typeof window === 'undefined') return;

  const updateOnline = () => {
    isOnline.value = navigator.onLine;
  };

  window.addEventListener('online', updateOnline);
  window.addEventListener('offline', updateOnline);
  updateOnline();

  removeListeners = () => {
    window.removeEventListener('online', updateOnline);
    window.removeEventListener('offline', updateOnline);
    removeListeners = null;
  };
}

export function useNetworkStatus() {
  listenerCount += 1;
  if (!removeListeners) setupListeners();

  onScopeDispose(() => {
    listenerCount = Math.max(0, listenerCount - 1);
    if (listenerCount === 0) {
      removeListeners?.();
    }
  });

  return { isOnline };
}
