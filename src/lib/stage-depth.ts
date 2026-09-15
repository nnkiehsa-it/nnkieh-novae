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
const sheets: HTMLElement[] = [];

function publishDepth() {
  document.documentElement.dataset.sheetDepth = String(held);
  sheets.forEach((sheet, index) => {
    const depth = sheets.length - index - 1;
    sheet.dataset.sheetDepthBehind = String(depth);
    sheet.style.setProperty("--sheet-depth-behind", String(Math.min(depth, 5)));
  });
}

/** Holds the page still for one sheet. Answers with the release. */
export function holdStageBehind(sheet?: HTMLElement | null) {
  const root = document.documentElement;
  held += 1;
  if (sheet) sheets.push(sheet);
  publishDepth();
  if (held === 1) {
    root.style.setProperty("--stage-scroll", `${window.scrollY}px`);
    root.style.setProperty("--stage-height", `${root.scrollHeight}px`);
  }
  return () => {
    held -= 1;
    if (sheet) {
      const index = sheets.indexOf(sheet);
      if (index >= 0) sheets.splice(index, 1);
    }
    publishDepth();
    if (held > 0) return;
    root.style.removeProperty("--stage-scroll");
    root.style.removeProperty("--stage-height");
  };
}
