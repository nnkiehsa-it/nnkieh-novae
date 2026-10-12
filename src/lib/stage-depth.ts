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
let notifyPendingNavigationCommit: ((pathname: string) => void) | null = null;
let notifyPendingFocusRestore: (() => void) | null = null;

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
export function holdStageBehind(sheet?: HTMLElement | null, sourceScrollY?: number) {
  const root = document.documentElement;
  let released = false;
  held += 1;
  if (sheet) sheets.push(sheet);
  publishDepth();
  if (held === 1) {
    // Inserting the sheet must not fix the stage before these reads. WebKit
    // clamps scrollY as soon as the tall page leaves the document flow.
    const scroll = sourceScrollY ?? window.scrollY;
    const height = root.scrollHeight;
    root.style.setProperty("--stage-scroll", `${scroll}px`);
    root.style.setProperty("--stage-height", `${height}px`);
    root.dataset.stageHeld = "true";
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
    delete root.dataset.stageHeld;
    root.style.removeProperty("--stage-scroll");
    root.style.removeProperty("--stage-height");
  };
}

/** The source-page position captured before the first sheet fixed the stage. */
export function heldStageScrollY() {
  const value = Number.parseFloat(
    document.documentElement.style.getPropertyValue("--stage-scroll"),
  );
  return Number.isFinite(value) ? value : window.scrollY;
}

/**
 * Traverse out of an intercepted sheet without letting browser history, focus
 * restoration, and the fixed-stage release compete over the source position.
 */
export function restoreHeldStageAfterNavigation(navigate: () => void) {
  const root = document.documentElement;
  const sourcePathname = window.location.pathname;
  const scrollX = window.scrollX;
  const scrollY = heldStageScrollY();
  const previousRestoration = window.history.scrollRestoration;
  let navigated = false;
  let routeCommitted = false;
  let focusRestored = false;

  window.history.scrollRestoration = "manual";

  const observer = new MutationObserver(() => restoreWhenReady());
  const restoreWhenReady = () => {
    if (
      !navigated
      || !routeCommitted
      || !focusRestored
      || root.dataset.stageHeld === "true"
      || document.body.hasAttribute("data-scroll-locked")
    ) return;
    observer.disconnect();
    notifyPendingNavigationCommit = null;
    notifyPendingFocusRestore = null;
    window.requestAnimationFrame(() => {
      window.scrollTo(scrollX, scrollY);
      window.requestAnimationFrame(() => {
        window.scrollTo(scrollX, scrollY);
        window.history.scrollRestoration = previousRestoration;
      });
    });
  };

  observer.observe(root, { attributeFilter: ["data-stage-held"] });
  observer.observe(document.body, { attributeFilter: ["data-scroll-locked"] });
  notifyPendingNavigationCommit = (pathname) => {
    if (pathname === sourcePathname) return;
    routeCommitted = true;
    restoreWhenReady();
  };
  notifyPendingFocusRestore = () => {
    focusRestored = true;
    restoreWhenReady();
  };
  window.addEventListener("popstate", () => {
    navigated = true;
    restoreWhenReady();
  }, { once: true });
  navigate();
}

/** Publishes the pathname only after React has committed the routed shell. */
export function publishStageNavigationCommit(pathname: string) {
  notifyPendingNavigationCommit?.(pathname);
}

/** Publishes that the dialog primitive has finished returning focus. */
export function publishStageFocusRestore() {
  notifyPendingFocusRestore?.();
}
