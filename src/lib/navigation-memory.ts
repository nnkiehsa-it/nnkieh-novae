interface ClientRouter {
  back(): void;
  push(href: string): void;
}

let currentPath = "";
let previousPath = "";
let pendingRouteDirection: RouteDirection = "forward";

export type RouteDirection = "back" | "forward";

export function markRouteDirection(direction: RouteDirection) {
  pendingRouteDirection = direction;
}

export function consumeRouteDirection() {
  const direction = pendingRouteDirection;
  pendingRouteDirection = "forward";
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
