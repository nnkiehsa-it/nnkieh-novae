/** Protected routes use F7 PageContent; standalone startup pages use the document. */
function pageScroller() { return document.querySelector<HTMLElement>(".novae-page-content"); }
export function appScrollY() { return pageScroller()?.scrollTop ?? window.scrollY; }
export function scrollAppTo(x: number, y: number) {
  const page = pageScroller();
  if (page) page.scrollTo(x, y);
  else window.scrollTo(x, y);
}
