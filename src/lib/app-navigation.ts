/**
 * Moving between screens without reloading the page.
 *
 * The whole app is one React Router instance; this module holds it so code
 * outside a component (a mutation's success handler, a guard) can change the
 * address too. Entries pushed this way are marked, so a record can tell
 * whether stepping back would leave it for the list it was opened from.
 */

const IN_APP = /^\/(?:home|feed|notifications|settings|admin|issues|facilities|announcements)(?:[/?#]|$)/u;
const MARK = "novaeInApp";

interface AppLocationState {
  [MARK]?: boolean;
}

/** The part of a React Router data router this module drives. */
export interface AppRouter {
  navigate(to: string, options?: { replace?: boolean; state?: AppLocationState }): Promise<void>;
  readonly state: { location: { hash: string; pathname: string; search: string; state: unknown } };
}

let router: AppRouter | null = null;

/** Called once with the app's router, before it renders. */
export function bindRouter(next: AppRouter | null) {
  router = next;
}

/** Whether `href` names a signed-in screen. */
export function isInAppHref(href: string) {
  return IN_APP.test(href);
}

function isRouterHref(href: string) {
  return href.startsWith("/") && !href.startsWith("//");
}

function marked() {
  const state = router?.state.location.state as AppLocationState | null | undefined;
  return Boolean(state?.[MARK]);
}

function currentAddress() {
  const { hash, pathname, search } = router?.state.location ?? window.location;
  return `${pathname}${search}${hash}`;
}

/**
 * Shows `href` in place. Returns false when the caller must navigate the
 * ordinary way: there is no router yet, or `href` leaves this origin.
 */
export function navigate(href: string, { replace = false }: { replace?: boolean } = {}) {
  if (!router || !isRouterHref(href)) return false;
  if (replace) void router.navigate(href, { replace: true, state: { [MARK]: marked() } });
  else pushAddress(href);
  return true;
}

/**
 * Records a change to the screen already showing, such as a filter, as its
 * own history entry so Back undoes it. Pushing the address already showing
 * adds nothing.
 */
export function pushAddress(href: string) {
  if (href === currentAddress()) return;
  if (router) void router.navigate(href, { state: { [MARK]: true } });
  else window.history.pushState({ [MARK]: true }, "", href);
}

/** Rewrites the address on screen without a history entry, keeping its mark. */
export function replaceAddress(href: string) {
  if (href === currentAddress()) return;
  if (router) void router.navigate(href, { replace: true, state: { [MARK]: marked() } });
  else window.history.replaceState(window.history.state, "", href);
}

/** Whether the entry on screen was reached from inside the app, so Back stays in it. */
export function canStepBack() {
  return marked();
}
