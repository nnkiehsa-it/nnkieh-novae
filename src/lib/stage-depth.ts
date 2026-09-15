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
  document.documentElement.dataset.sheetDepth = String(sheets.length);
  sheets.forEach((sheet, index) => {
    const depth = sheets.length - index - 1;
    const previousDepth = Number(sheet.dataset.sheetDepthBehind ?? depth);
    sheet.dataset.sheetDepthBehind = String(depth);
    sheet.dataset.sheetStackIndex = String(index);
    sheet.dataset.sheetStackMotion = depth > previousDepth ? "push" : depth < previousDepth ? "pop" : "idle";
    sheet.style.setProperty("--sheet-depth-behind", String(Math.min(depth, 5)));
    sheet.style.setProperty("--sheet-stack-index", String(Math.min(index, 5)));
    sheet.style.setProperty("--sheet-stack-inset", `${Math.min(index, 5) * 13}px`);
  });
}

/**
 * Take a departing sheet out of the visible stack before it unmounts. Sheets
 * behind it can then animate back one rung while the departing sheet runs its
 * own exit animation. The stage hold remains until unmount so scroll geometry
 * does not jump during the exit.
 */
export function beginSheetClose(sheet?: HTMLElement | null) {
  if (!sheet) return;
  const index = sheets.indexOf(sheet);
  if (index < 0) return;
  sheets.splice(index, 1);
  publishDepth();
}

/** Holds the page still for one sheet. Answers with the release. */
export function holdStageBehind(sheet?: HTMLElement | null) {
  const root = document.documentElement;
  let released = false;
  held += 1;
  if (sheet) sheets.push(sheet);
  publishDepth();
  if (held === 1) {
    root.style.setProperty("--stage-scroll", `${window.scrollY}px`);
    root.style.setProperty("--stage-height", `${root.scrollHeight}px`);
  }
  return () => {
    if (released) return;
    released = true;
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
