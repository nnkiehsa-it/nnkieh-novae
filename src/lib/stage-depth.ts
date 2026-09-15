/**
 * The page's own measurements, held still while a sheet is over it.
 *
 * A sheet pushes the page back, which means the page has to become one card the
 * size of the screen rather than the tall scrolling document it is: only then
 * do its corners round at the corners of the screen, and only then does a bar
 * pinned to the bottom of the page stay pinned to the bottom of the card.
 *
 * Taking the page out of the flow to do that would collapse the document, and
 * the browser would answer by scrolling to the top -- so the two figures CSS
 * needs are written down first: how far the reader had scrolled, which is how
 * far the card's content is lifted, and how tall the document was, which the
 * page keeps so the scroll position is still there when the sheet leaves.
 */
let held = 0;

/** Holds the page still for one sheet. Answers with the release. */
export function holdStageBehind() {
  const root = document.documentElement;
  held += 1;
  if (held === 1) {
    root.style.setProperty("--stage-scroll", `${window.scrollY}px`);
    root.style.setProperty("--stage-height", `${root.scrollHeight}px`);
  }
  return () => {
    held -= 1;
    if (held > 0) return;
    root.style.removeProperty("--stage-scroll");
    root.style.removeProperty("--stage-height");
  };
}
