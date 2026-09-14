/**
 * The mark a link carries when it reached the reader through somebody else.
 *
 * It lives here because both the share itself and the handoff out of a
 * messaging app's browser have to write it, and those two cannot import each
 * other.
 */
export const SHARE_ENTRY_PARAM = "shared";

// The three routes a share button exists on. A composer shares the shape of a
// detail URL without being one, so it is named out rather than matched.
const SHARED_ROUTE_PATTERN =
  /^\/(?:announcements|facilities)\/(?!new$)[^/]+$|^\/issues\/[^/]+\/(?!new$)[^/]+$/u;

/**
 * A page that is one piece of content, and so can be sent to somebody on its
 * own.
 *
 * Sending the whole of Novae is a different thing from sending one proposal:
 * the reader who is handed a feed, or the front door, is meeting the app for
 * the first time and should be invited to install it. Only a single piece of
 * content earns the shorter path, because that reader came for one page.
 */
export function isSharedRoute(pathname: string) {
  return SHARED_ROUTE_PATTERN.test(pathname);
}
