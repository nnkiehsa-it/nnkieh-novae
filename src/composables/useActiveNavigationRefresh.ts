import { onScopeDispose } from 'vue';

type ActiveNavigationRefreshHandler = () => void | Promise<void>;

let activeHandler: ActiveNavigationRefreshHandler | null = null;

export function registerActiveNavigationRefreshHandler(handler: ActiveNavigationRefreshHandler) {
  activeHandler = handler;
  onScopeDispose(() => {
    if (activeHandler === handler) activeHandler = null;
  });
}

export function refreshFromActiveNavigation() {
  return activeHandler?.();
}
