/**
 * What a pointer is actually on.
 *
 * Two features need the same answer to that question — the feedback a tap on a
 * destination wears while the route is on its way, and the prefetch that starts
 * before the tap — so the reading of the DOM lives once, here, rather than
 * twice in two components that would drift apart.
 */
const INTERACTIVE_SELECTOR =
  "a[href], button, [role='button'], [role='menuitem'], [role='option'], [role='radio'], [role='checkbox'], [role='tab'], [role='switch'], [data-slot='select-trigger']";

/** The interactive control an event landed on, if it landed on one at all. */
export function interactiveTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLElement>(INTERACTIVE_SELECTOR);
}

/**
 * The anchor a control sits in, when following it means navigating this app to
 * somewhere else. A new tab, a download, another origin and the page the user
 * is already on are all somebody else's business.
 */
export function internalAnchor(target: HTMLElement) {
  const anchor = target.closest<HTMLAnchorElement>("a[href]");
  if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) {
    return null;
  }
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  if (
    `${url.pathname}${url.search}${url.hash}` ===
    `${location.pathname}${location.search}${location.hash}`
  ) {
    return null;
  }
  return anchor;
}

/** Where an anchor points, as the router names a route: path and query, no hash. */
export function internalHref(anchor: HTMLAnchorElement) {
  const url = new URL(anchor.href, window.location.href);
  return `${url.pathname}${url.search}`;
}

/** Whether a control refuses interaction, itself or through an ancestor. */
export function isDisabledTarget(target: HTMLElement) {
  const disabled = ":disabled, [aria-disabled='true'], [data-disabled]";
  return target.matches(disabled) || Boolean(target.closest(disabled));
}
