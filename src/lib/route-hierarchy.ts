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

/** Primary destinations use live motion so their navigation remains interactive. */
export function isPrimaryRoute(pathname: string) {
  return (
    /^\/issues\/[^/]+$/u.test(pathname) ||
    ["/announcements", "/facilities", "/notifications", "/settings"].includes(
      pathname,
    )
  );
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
