/** The element pages scroll in (see `#app-scroll` in theme.css), or the document outside the app shell. */
export function appScroller(): HTMLElement {
  return document.getElementById("app-scroll") ?? document.documentElement;
}
