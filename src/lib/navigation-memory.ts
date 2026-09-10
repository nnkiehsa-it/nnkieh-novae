interface ClientRouter {
  back(): void;
  push(href: string): void;
}

let currentPath = "";
let previousPath = "";

export function rememberCurrentRoute(pathname: string) {
  if (!pathname || pathname === currentPath) return;
  previousPath = currentPath;
  currentPath = pathname;
}

// The update has to stay open until the traversal has actually rendered, or the
// browser captures the route being left as both states of the transition.
function routeSurfaceReplaced(leaving: HTMLElement) {
  return new Promise<void>((resolve) => {
    const observer = new MutationObserver(() => {
      if (leaving.isConnected) return;
      observer.disconnect();
      resolve();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
}

// Next dispatches a history traversal outside a React Transition on purpose, to
// keep Back instant, so React never starts a view transition for one and the
// route would otherwise swap with nothing to see. The traversal is wrapped in a
// view transition here instead: the stylesheet names the two surfaces while the
// attribute is set, since the boundary is not doing it this time, and hands
// them the classes the boundary would have, so going back lands on exactly the
// same recipes as going forward and needs no second set of its own.
function traverseBack(router: ClientRouter) {
  const root = document.documentElement;
  const leaving = document.querySelector<HTMLElement>(".route-page");
  if (
    !leaving ||
    !("startViewTransition" in document) ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    router.back();
    return;
  }
  leaving.dataset.routeLeaving = "";
  root.dataset.routeTraversal = "";
  const transition = document.startViewTransition(async () => {
    router.back();
    await routeSurfaceReplaced(leaving);
  });
  void transition.finished.finally(() => {
    delete root.dataset.routeTraversal;
  });
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
    traverseBack(router);
    return;
  }
  router.push(fallback);
}

export function returnToPreviousInAppRoute(
  router: ClientRouter,
  fallback: string,
) {
  if (previousPath && previousPath !== currentPath) {
    traverseBack(router);
    return;
  }
  router.push(fallback);
}
