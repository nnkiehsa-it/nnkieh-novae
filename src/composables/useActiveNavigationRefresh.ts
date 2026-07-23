import { onScopeDispose } from 'vue';

type ActiveNavigationRefreshHandler = () => void | Promise<void>;

const ACTIVE_NAVIGATION_REFRESH_COOLDOWN_MS = 20_000;
let activeHandler: ActiveNavigationRefreshHandler | null = null;
let lastRefreshAt = 0;

export function registerActiveNavigationRefreshHandler(handler: ActiveNavigationRefreshHandler) {
  activeHandler = handler;
  onScopeDispose(() => {
    if (activeHandler === handler) activeHandler = null;
  });
}

export function refreshFromActiveNavigation() {
  const now = Date.now();
  if (!activeHandler || now - lastRefreshAt < ACTIVE_NAVIGATION_REFRESH_COOLDOWN_MS) return;
  lastRefreshAt = now;
  return activeHandler();
}
