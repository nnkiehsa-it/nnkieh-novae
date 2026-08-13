interface ClientRouter {
  back(): void;
  push(href: string): void;
}

let currentPath = "";
let previousPath = "";
let directionReset = 0;

export type RouteDirection = "back" | "restore";

export function markRouteDirection(direction: RouteDirection) {
  document.documentElement.dataset.routeDirection = direction;
  window.clearTimeout(directionReset);
  directionReset = window.setTimeout(() => {
    delete document.documentElement.dataset.routeDirection;
  }, 700);
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
    markRouteDirection("restore");
    router.back();
    return;
  }
  router.push(fallback);
}

export function returnToPreviousInAppRoute(
  router: ClientRouter,
  fallback: string,
) {
  if (previousPath && previousPath !== currentPath) {
    markRouteDirection("restore");
    router.back();
    return;
  }
  markRouteDirection("back");
  router.push(fallback);
}
