import { isRecordRoute } from "@/lib/route-hierarchy";

/**
 * The mark a link carries when it reached the reader through somebody else.
 *
 * It lives here because both the share itself and the handoff out of a
 * messaging app's browser have to write it, and those two cannot import each
 * other.
 */
export const SHARE_ENTRY_PARAM = "shared";

/** Where sign-in carries the page a reader asked for before they had an account. */
export const SHARE_REDIRECT_PARAM = "redirect";

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
  return isRecordRoute(pathname);
}

/**
 * The page a load is about: the address itself, or -- when signing in is
 * holding the reader at the door -- the page it is holding them for.
 *
 * A reader who is not signed in never sees the address they were sent. Novae
 * answers with the sign-in page and carries the page they asked for in
 * `redirect`, so by the time anything reads the address, the one thing that
 * says they were sent a single proposal is that parameter.
 */
export function sharedDestinationPath(href: string) {
  const url = new URL(href);
  const requested = url.searchParams.get(SHARE_REDIRECT_PARAM);
  if (requested?.startsWith("/") && !requested.startsWith("//")) {
    return new URL(requested, url.origin).pathname;
  }
  return url.pathname;
}
