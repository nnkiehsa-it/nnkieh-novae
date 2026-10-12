const EDITABLE_SELECTOR =
  "input, textarea, [contenteditable]:not([contenteditable='false']), [data-selectable]";

/** Editing keeps the system's selection, copy/paste menu and drag operations. */
function isEditable(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest(EDITABLE_SELECTOR));
}

export function installBrowserBehavior() {
  const prevent = (event: Event) => event.preventDefault();
  const preventOutsideEditor = (event: Event) => {
    if (!isEditable(event.target)) event.preventDefault();
  };
  const preventPinch = (event: TouchEvent) => {
    if (event.touches.length > 1) event.preventDefault();
  };
  const preventWheelZoom = (event: WheelEvent) => {
    if (event.ctrlKey) event.preventDefault();
  };
  const preventKeyboardZoom = (event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && ["+", "-", "=", "_", "0"].includes(event.key)) {
      event.preventDefault();
    }
  };
  const cancelable = { capture: true, passive: false };

  // WebKit exposes gesture events in addition to the standard touch events.
  document.addEventListener("gesturestart", prevent, cancelable);
  document.addEventListener("gesturechange", prevent, cancelable);
  document.addEventListener("touchstart", preventPinch, cancelable);
  document.addEventListener("touchmove", preventPinch, cancelable);
  document.addEventListener("wheel", preventWheelZoom, cancelable);
  document.addEventListener("keydown", preventKeyboardZoom, true);
  document.addEventListener("contextmenu", preventOutsideEditor, true);
  document.addEventListener("selectstart", preventOutsideEditor, true);
  document.addEventListener("dragstart", preventOutsideEditor, true);

  return () => {
    document.removeEventListener("gesturestart", prevent, true);
    document.removeEventListener("gesturechange", prevent, true);
    document.removeEventListener("touchstart", preventPinch, true);
    document.removeEventListener("touchmove", preventPinch, true);
    document.removeEventListener("wheel", preventWheelZoom, true);
    document.removeEventListener("keydown", preventKeyboardZoom, true);
    document.removeEventListener("contextmenu", preventOutsideEditor, true);
    document.removeEventListener("selectstart", preventOutsideEditor, true);
    document.removeEventListener("dragstart", preventOutsideEditor, true);
  };
}
