// Settings owns the dashboard and administration areas even though their URLs
// do not sit beneath /settings, so the one place that knows it is here: both
// navigation highlighting and navigation direction read it from this table.
const ADOPTED_PARENTS: ReadonlyArray<readonly [prefix: string, parent: string]> = [
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

export type RouteRelation = "deeper" | "shallower" | "unrelated";

/**
 * How `to` sits relative to `from` in the information hierarchy. Only a move
 * along one branch is deeper or shallower; switching branches, or swapping one
 * sibling for another, is neither.
 */
export function compareRoutes(from: string, to: string): RouteRelation {
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
