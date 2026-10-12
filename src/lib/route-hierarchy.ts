// Settings owns the administration area even though its URLs do not sit beneath
// /settings, so navigation highlighting reads that from this table.
const ADOPTED_PARENTS: ReadonlyArray<readonly [prefix: string, parent: string]> = [["/admin", "/settings"]];

function adoptedParent(pathname: string): string | null {
  for (const [prefix, parent] of ADOPTED_PARENTS) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return parent;
  }
  return null;
}

// The three routes that are one record: a proposal, a facility report or an
// announcement. A composer shares the shape of one without being one, so it is
// named out rather than matched.
const RECORD_ROUTE_PATTERN =
  /^\/(?:announcements|facilities)\/(?!new$)[^/]+$|^\/issues\/[^/]+\/(?!new$)[^/]+$/u;

/** A page that is one piece of content, and so can be sent to somebody alone. */
export function isRecordRoute(pathname: string) {
  return RECORD_ROUTE_PATTERN.test(pathname);
}

/**
 * The primary destination `pathname` belongs to: a record or a composer is
 * part of the feed, and administration is part of settings.
 */
export function primaryDestination(pathname: string) {
  if (/^\/(?:issues|facilities|announcements)(?:\/|$)/u.test(pathname)) return "/feed";
  return adoptedParent(pathname) ?? pathname;
}

/** A composer fills the screen with its own actions, so the dock steps aside. */
export function hidesDock(pathname: string) {
  return /\/(?:new|setup)$/u.test(pathname);
}
