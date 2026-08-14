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
  return pendingRouteDirection ?? (isRootRoute(pathname) ? "root" : "child");
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
  // A route can render more than once while its loading boundary resolves.
  // Keep the intended direction through those renders, then retire it only
  // once the destination pathname is committed.
  pendingRouteDirection = null;
}

export function markPopstateRouteDirection(state: unknown, pathname: string) {
  const targetIndex = readHistoryIndex(state);
  if (targetIndex === null || currentHistoryIndex === null) {
    // Without our stamp this is still a browser history traversal, so retain
    // the return motion instead of treating a detail pathname as a new child.
    markRouteDirection("back");
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
