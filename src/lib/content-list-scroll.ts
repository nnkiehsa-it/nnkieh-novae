const CONTENT_ITEM_SELECTOR = '[data-content-id]';

interface ScrollAnchor {
  id: string;
  top: number;
}

function captureScrollAnchor(): ScrollAnchor | null {
  const items = Array.from(document.querySelectorAll<HTMLElement>(CONTENT_ITEM_SELECTOR));
  const item = items.find((candidate) => candidate.getBoundingClientRect().bottom > 0);
  const id = item?.dataset.contentId;
  return item && id ? { id, top: item.getBoundingClientRect().top } : null;
}

function restoreScrollAnchor(anchor: ScrollAnchor) {
  const escapedId = CSS.escape(anchor.id);
  const item = document.querySelector<HTMLElement>(`[data-content-id="${escapedId}"]`);
  if (!item) return;
  const delta = item.getBoundingClientRect().top - anchor.top;
  if (Math.abs(delta) < 1) return;
  window.scrollBy({ top: delta, behavior: 'instant' });
}

export async function preserveContentListScroll<T>(operation: () => Promise<T>) {
  const anchor = captureScrollAnchor();
  const result = await operation();
  if (anchor) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    restoreScrollAnchor(anchor);
  }
  return result;
}
