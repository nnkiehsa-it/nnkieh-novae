interface ClientRouter {
  back(): void;
  push(href: string): void;
}

let currentPath = "";
let previousPath = "";
let pendingRouteDirection: RouteDirection | null = null;

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
