// Settings owns the dashboard and administration areas even though their URLs
// do not sit beneath /settings, so the one place that knows it is here: both
// navigation highlighting and navigation direction read it from this table.
const ADOPTED_PARENTS: ReadonlyArray<
  readonly [prefix: string, parent: string]
> = [
  ["/dashboard", "/settings"],
  ["/admin", "/settings"],
];

/** The route that owns `pathname` when its URL does not say so itself. */
export function adoptedParent(pathname: string): string | null {
  for (const [prefix, parent] of ADOPTED_PARENTS) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return parent;
  }
  return null;
}

function hierarchy(pathname: string): string[] {
  const parent = adoptedParent(pathname);
  const segments = pathname.split("/").filter(Boolean);
  return parent ? [...hierarchy(parent), ...segments] : segments;
}

// /issues only picks a default category and forwards to it. It is a doorway,
// not a place, so crossing it has no direction worth animating: without this the
// forward from /issues to /issues/<category> read as a push into a child route
// and played the whole navigation animation on the way to somewhere the user
// had already asked for.
const FORWARDING_ROUTES: ReadonlySet<string> = new Set(["/issues"]);

export type RouteRelation = "deeper" | "shallower" | "unrelated";

// The places primary navigation points at. Everything else the shell renders is
// a place beneath one of them -- a detail, a composer, or an area settings
// adopted -- so this one table answers both of the questions the shell asks
// about a route, and the navigation bar only has to supply the labels.
// An issue feed is a filter of one place rather than a route of its own, which
// is why every `/issues/<filter>` is the same destination.
const PRIMARY_ROUTES: ReadonlySet<string> = new Set([
  "/announcements",
  "/facilities",
  "/notifications",
  "/settings",
]);

/** A destination primary navigation points at. */
export function isPrimaryRoute(pathname: string) {
  return PRIMARY_ROUTES.has(pathname) || /^\/issues\/[^/]+$/u.test(pathname);
}

/**
 * Whether the floating navigation bar belongs on this route: a destination it
 * points at, or a doorway on the way to one. A doorway keeps it because the bar
 * would otherwise leave and return within the same navigation.
 */
export function showsPrimaryNavigation(pathname: string) {
  return isPrimaryRoute(pathname) || FORWARDING_ROUTES.has(pathname);
}

/**
 * How `to` sits relative to `from` in the information hierarchy. Only a move
 * along one branch is deeper or shallower; switching branches, or swapping one
 * sibling for another, is neither.
 */
export function compareRoutes(from: string, to: string): RouteRelation {
  if (FORWARDING_ROUTES.has(from) || FORWARDING_ROUTES.has(to))
    return "unrelated";
  const before = hierarchy(from);
  const after = hierarchy(to);
  const shared = Math.min(before.length, after.length);
  for (let index = 0; index < shared; index += 1) {
    if (before[index] !== after[index]) return "unrelated";
  }
  if (after.length > before.length) return "deeper";
  if (before.length > after.length) return "shallower";
  return "unrelated";
}
