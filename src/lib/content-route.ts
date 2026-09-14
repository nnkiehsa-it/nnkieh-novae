import type { ContentEntityDomain } from "@/lib/content-entity-store";

/**
 * The record a detail route is about, read from the URL alone.
 *
 * Knowing this before the route is entered is what lets the record be on its
 * way while the tap is still being made, so the page opens on content rather
 * than on its own skeleton.
 */
export interface ContentRouteTarget {
  domain: ContentEntityDomain;
  id: string;
}

const DETAIL_ROUTES: ReadonlyArray<
  readonly [pattern: RegExp, domain: ContentEntityDomain]
> = [
  [/^\/issues\/[^/]+\/([^/]+)$/u, "issue"],
  [/^\/facilities\/([^/]+)$/u, "facility"],
  [/^\/announcements\/([^/]+)$/u, "announcement"],
];

// A composer is not a record, and neither is the placeholder the route preload
// warms the dynamic segments with.
const NOT_A_RECORD: ReadonlySet<string> = new Set(["new", "__route-preload__"]);

/** The record `pathname` shows, or null when it is not a detail route. */
export function contentRouteTarget(pathname: string): ContentRouteTarget | null {
  for (const [pattern, domain] of DETAIL_ROUTES) {
    const id = pattern.exec(pathname)?.[1];
    if (!id || NOT_A_RECORD.has(id)) continue;
    return { domain, id: decodeURIComponent(id) };
  }
  return null;
}
