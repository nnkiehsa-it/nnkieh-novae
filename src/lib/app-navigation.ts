/**
 * Moving between screens of the signed-in app without asking the server.
 *
 * Every signed-in screen is drawn by one client view host from the address
 * bar, so a link inside it only has to change the address: Next keeps
 * `usePathname` and `useSearchParams` in step with `history.pushState`.
 * Entries pushed this way are marked, so a record can tell whether stepping
 * back would leave it for the list it was opened from.
 */

const IN_APP = /^\/(?:home|feed|notifications|settings|admin|issues|facilities|announcements)(?:[/?#]|$)/u;
const MARK = "novaeInApp";

let hostMounted = false;

/** Called by the view host while it is on screen. */
export function setViewHostMounted(mounted: boolean) {
  hostMounted = mounted;
}

/** Whether `href` names a screen the view host can draw. */
export function isInAppHref(href: string) {
  return IN_APP.test(href);
}

/**
 * Shows `href` in place. Returns false when the caller must navigate the
 * ordinary way: the view host is not mounted, or `href` leaves the app.
 */
export function navigate(href: string, { replace = false }: { replace?: boolean } = {}) {
  if (!hostMounted || !isInAppHref(href)) return false;
  if (replace) window.history.replaceState({ [MARK]: Boolean(window.history.state?.[MARK]) }, "", href);
  else pushAddress(href);
  return true;
}

/**
 * Records a change to the screen already showing, such as a filter, as its
 * own history entry so Back undoes it. Nothing new has to be drawn, so this
 * does not need the view host.
 */
export function pushAddress(href: string) {
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (href !== current) window.history.pushState({ [MARK]: true }, "", href);
}

/** Whether the entry on screen was reached from inside the app, so Back stays in it. */
export function canStepBack() {
  return typeof window !== "undefined" && Boolean(window.history.state?.[MARK]);
}
