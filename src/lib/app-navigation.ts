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
  readonly state: { location: AppRouterLocation };
  subscribe(listener: (state: { location: AppRouterLocation }) => void): () => void;
}

interface AppRouterLocation {
  hash: string;
  pathname: string;
  search: string;
  state: unknown;
}

let router: AppRouter | null = null;
let unsubscribe: (() => void) | null = null;
/** The address last asked for, until the router commits an address. */
let requested: string | null = null;
const requestListeners = new Set<() => void>();

function setRequested(next: string | null) {
  if (next === requested) return;
  requested = next;
  for (const listener of requestListeners) listener();
}

/** Called once with the app's router, before it renders. */
export function bindRouter(next: AppRouter | null) {
  unsubscribe?.();
  router = next;
  setRequested(null);
  let shown = next?.state.location;
  unsubscribe = next?.subscribe(({ location }) => {
    if (location === shown) return;
    shown = location;
    setRequested(null);
  }) ?? null;
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
 * The address the screen is heading to: the one last asked for while the
 * router has not committed it yet, otherwise the one showing. A change built
 * on it keeps a change made a moment earlier; the router drops a navigation
 * that a newer one overtakes, so a change built on the address still showing
 * would lose it.
 */
export function requestedAddress() {
  return requested ?? currentAddress();
}

/**
 * The address asked for and not committed yet, or null. The router commits a
 * beat after the request; any commit clears it, the request's own or a step
 * back taken before it landed.
 */
export function pendingAddress() {
  return requested;
}

export function subscribePendingAddress(listener: () => void) {
  requestListeners.add(listener);
  return () => void requestListeners.delete(listener);
}

function go(href: string, options: { replace?: boolean; state: AppLocationState }) {
  if (!router) return;
  setRequested(href);
  void router.navigate(href, options);
}

/**
 * Shows `href` in place. Returns false when the caller must navigate the
 * ordinary way: there is no router yet, or `href` leaves this origin.
 */
export function navigate(href: string, { replace = false }: { replace?: boolean } = {}) {
  if (!router || !isRouterHref(href)) return false;
  if (replace) go(href, { replace: true, state: { [MARK]: marked() } });
  else pushAddress(href);
  return true;
}

/**
 * Records a change to the screen already showing, such as a filter, as its
 * own history entry so Back undoes it. Pushing the address already showing
 * adds nothing.
 */
export function pushAddress(href: string) {
  if (href === requestedAddress()) return;
  if (router) go(href, { state: { [MARK]: true } });
  else window.history.pushState({ [MARK]: true }, "", href);
}

/** Rewrites the address on screen without a history entry, keeping its mark. */
export function replaceAddress(href: string) {
  if (href === requestedAddress()) return;
  if (router) go(href, { replace: true, state: { [MARK]: marked() } });
  else window.history.replaceState(window.history.state, "", href);
}

/** Whether the entry on screen was reached from inside the app, so Back stays in it. */
export function canStepBack() {
  return marked();
}
