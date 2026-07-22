const DOUBLE_TAP_WINDOW_MS = 320;
const DOUBLE_TAP_DISTANCE_PX = 28;

function isEditableTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

export function preventDoubleTapZoom() {
  let previousTouch: { at: number; x: number; y: number } | null = null;
  document.addEventListener('touchend', (event) => {
    if (event.changedTouches.length !== 1 || isEditableTarget(event.target)) {
      previousTouch = null;
      return;
    }
    const touch = event.changedTouches[0];
    if (!touch) return;
    const now = performance.now();
    const isDoubleTap = previousTouch
      && now - previousTouch.at <= DOUBLE_TAP_WINDOW_MS
      && Math.hypot(touch.clientX - previousTouch.x, touch.clientY - previousTouch.y) <= DOUBLE_TAP_DISTANCE_PX;
    if (isDoubleTap) {
      event.preventDefault();
      previousTouch = null;
      return;
    }
    previousTouch = { at: now, x: touch.clientX, y: touch.clientY };
  }, { capture: true, passive: false });

  document.addEventListener('dblclick', (event) => {
    if (!isEditableTarget(event.target)) event.preventDefault();
  }, { capture: true, passive: false });
}
