import { detectInAppBrowser } from "@/lib/in-app-browser";

/**
 * Marks a link as one that left Novae and came back through somebody else.
 *
 * A reader who arrives this way is in a plain browser tab rather than the
 * installed app, and the first thing they want is the page they were sent —
 * not an invitation to install anything.
 */
export const SHARE_ENTRY_PARAM = "shared";

function buildShareUrl(href: string) {
  const url = new URL(href);
  url.searchParams.set(SHARE_ENTRY_PARAM, "1");
  return url.toString();
}

export function hasShareEntryMarker() {
  return new URL(window.location.href).searchParams.has(SHARE_ENTRY_PARAM);
}

// The three routes a share button exists on. A composer shares the shape of a
// detail URL without being one, so it is named out rather than matched.
const SHARED_ROUTE_PATTERN =
  /^\/(?:announcements|facilities)\/(?!new$)[^/]+$|^\/issues\/[^/]+\/(?!new$)[^/]+$/u;

/** A page a share button exists on. */
export function isSharedRoute(pathname: string) {
  return SHARED_ROUTE_PATTERN.test(pathname);
}

/**
 * Whether this load looks like somebody else's link even though it carries no
 * marker, which is every link shared before the marker existed.
 *
 * Two things have to be true at once: the tab opened straight onto a page that
 * can be shared, and it has no history of its own, so nothing in Novae led here
 * — the reader was sent. A bookmark saved on a detail page reads the same way,
 * and is answered the same way, which costs that reader one question they can
 * decline.
 */
export function looksLikeSharedArrival() {
  return window.history.length <= 1 && isSharedRoute(window.location.pathname);
}

/**
 * Takes the marker back out of the address bar once it has been read, so that
 * what the reader sees and re-shares is the plain page address.
 *
 * Inside a messaging app's own browser the marker is left in place: that tab
 * cannot sign in, so the URL is about to be handed to the system browser and
 * has to carry the marker with it. The address is only rewritten after
 * hydration, when the page and the server agree on what the query string was.
 */
export function clearShareEntryMarker() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(SHARE_ENTRY_PARAM)) return;
  if (detectInAppBrowser(navigator.userAgent)) return;
  url.searchParams.delete(SHARE_ENTRY_PARAM);
  window.history.replaceState(window.history.state, "", url.toString());
}

export async function shareCurrentPage(title: string) {
  const url = buildShareUrl(window.location.href);
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
