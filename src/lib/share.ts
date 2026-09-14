import { SHARE_ENTRY_PARAM, isSharedRoute } from "@/constants/share";
import { detectInAppBrowser } from "@/lib/in-app-browser";

/**
 * Marks a link as one that left Novae and came back through somebody else.
 *
 * A reader who arrives this way is in a plain browser tab rather than the
 * installed app, and the first thing they want is the page they were sent —
 * not an invitation to install anything.
 */
function buildShareUrl(href: string) {
  const url = new URL(href);
  url.searchParams.set(SHARE_ENTRY_PARAM, "1");
  return url.toString();
}

/**
 * Whether this load is somebody else's link to one piece of content.
 *
 * Either the link says so, or it has the shape of one: the tab opened straight
 * onto a page that can be sent on its own and has no history of its own, so
 * nothing in Novae led here — the reader was sent. That second test is what
 * catches every link shared before links were marked. A bookmark saved on a
 * detail page reads the same way, and is answered the same way, which costs
 * that reader one question they can decline.
 */
export function arrivedFromSharedLink() {
  if (!isSharedRoute(window.location.pathname)) return false;
  return new URL(window.location.href).searchParams.has(SHARE_ENTRY_PARAM)
    || window.history.length <= 1;
}

/**
 * Settles the marker into the address bar, in whichever direction this browser
 * calls for, once hydration has agreed with the server on the query string.
 *
 * In a messaging app's own browser the marker is written in rather than taken
 * out. That tab cannot sign in, so its address is on its way to the system
 * browser — through our own handoff, or through the app's own "open in
 * browser" menu, which we never see. Everywhere else the marker has done its
 * work and is removed, so what the reader sees and re-shares is the plain page
 * address.
 */
export function settleShareEntryMarker() {
  const url = new URL(window.location.href);
  const marked = url.searchParams.has(SHARE_ENTRY_PARAM);
  if (detectInAppBrowser(navigator.userAgent) && isSharedRoute(url.pathname)) {
    if (marked) return;
    url.searchParams.set(SHARE_ENTRY_PARAM, "1");
  } else {
    if (!marked) return;
    url.searchParams.delete(SHARE_ENTRY_PARAM);
  }
  window.history.replaceState(window.history.state, "", url.toString());
}

/**
 * The address to hand somewhere else — to a copy, or to the system browser.
 *
 * Nobody types a URL into a messaging app's browser, so anything open in one
 * arrived through somebody else whether or not the link said so.
 */
export function shareHandoffUrl() {
  return buildShareUrl(window.location.href);
}

export async function shareCurrentPage(title: string) {
  const url = shareHandoffUrl();
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title, url });
      return "shared" as const;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError")
        return "cancelled" as const;
    }
  }
  await navigator.clipboard.writeText(url);
  return "copied" as const;
}
