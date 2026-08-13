interface ClientRouter {
  back(): void;
  push(href: string): void;
}

let currentPath = "";
let previousPath = "";

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
    router.back();
    return;
  }
  router.push(fallback);
}
