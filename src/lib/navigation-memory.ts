interface ClientRouter {
  back(): void;
  push(href: string): void;
}

let currentPath = "";
let previousPath = "";
let pendingRouteDirection: RouteDirection | null = null;
let currentHistoryIndex: number | null = null;
let pendingHistoryIndex: number | null = null;
const HISTORY_INDEX_KEY = "__novaeHistoryIndex";

export type RouteDirection = "back" | "child" | "root";

function isRootRoute(pathname: string) {
  return (
    /^\/issues\/[^/]+\/?$/u.test(pathname) ||
    ["/announcements", "/facilities", "/notifications", "/settings"].includes(
      pathname,
    )
  );
}

export function markRouteDirection(direction: RouteDirection) {
  pendingRouteDirection = direction;
}

export function consumeRouteDirection(pathname: string) {
  const direction =
    pendingRouteDirection ?? (isRootRoute(pathname) ? "root" : "child");
  pendingRouteDirection = null;
  return direction;
}

export function rememberRoutePath(pathname: string) {
  if (!pathname || pathname === currentPath) return;
  previousPath = currentPath;
  currentPath = pathname;
}

function readHistoryIndex(state: unknown) {
  if (!state || typeof state !== "object") return null;
  const value = (state as Record<string, unknown>)[HISTORY_INDEX_KEY];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stampHistoryIndex(index: number) {
  window.history.replaceState(
    { ...window.history.state, [HISTORY_INDEX_KEY]: index },
    "",
  );
}

export function commitRouteHistory(pathname: string) {
  if (typeof window === "undefined") {
    rememberRoutePath(pathname);
    return;
  }
  const stampedIndex = readHistoryIndex(window.history.state);
  if (currentHistoryIndex === null) {
    currentHistoryIndex = stampedIndex ?? 0;
    if (stampedIndex === null) stampHistoryIndex(currentHistoryIndex);
  } else if (pendingHistoryIndex !== null) {
    currentHistoryIndex = pendingHistoryIndex;
    pendingHistoryIndex = null;
  } else if (pathname !== currentPath) {
    currentHistoryIndex += 1;
    stampHistoryIndex(currentHistoryIndex);
  }
  rememberRoutePath(pathname);
}

export function markPopstateRouteDirection(state: unknown, pathname: string) {
  const targetIndex = readHistoryIndex(state);
  if (targetIndex === null || currentHistoryIndex === null) {
    markRouteDirection(isRootRoute(pathname) ? "root" : "child");
    return;
  }
  pendingHistoryIndex = targetIndex;
  markRouteDirection(
    targetIndex < currentHistoryIndex
      ? "back"
      : isRootRoute(pathname)
        ? "root"
        : "child",
  );
}

export function returnToPreviousRoute(
  router: ClientRouter,
  fallback: string,
  expectedPrefix: string,
) {
  if (
    previousPath === expectedPrefix ||
    previousPath.startsWith(`${expectedPrefix}/`) ||
    previousPath.startsWith(`${expectedPrefix}?`)
  ) {
    markRouteDirection("back");
    router.back();
    return;
  }
  markRouteDirection("back");
  router.push(fallback);
}

export function returnToPreviousInAppRoute(
  router: ClientRouter,
  fallback: string,
) {
  if (previousPath && previousPath !== currentPath) {
    markRouteDirection("back");
    router.back();
    return;
  }
  markRouteDirection("back");
  router.push(fallback);
}
