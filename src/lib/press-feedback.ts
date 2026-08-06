const PRESSABLE_SELECTOR = [
  'button:not(:disabled)',
  'a[href]:not([aria-disabled="true"])',
  '[role="button"]:not([aria-disabled="true"])',
  '[role="switch"]:not([aria-disabled="true"])',
  '[data-list-row-trigger]',
  '.pressable',
  '.interactive-surface',
  '.content-trigger',
  '.text-trigger',
  '.nav-item',
  '.dropdown-item',
  '.list-surface-row--interactive',
].join(',');

const RELEASE_VISIBLE_MS = 160;
const MOVE_TOLERANCE_PX = 12;

interface ActivePress {
  element: HTMLElement;
  startX: number;
  startY: number;
}

let initialized = false;

function findPressable(target: EventTarget | null) {
  return target instanceof Element ? target.closest<HTMLElement>(PRESSABLE_SELECTOR) : null;
}

export function initializePressFeedback() {
  if (initialized || typeof document === 'undefined' || typeof window === 'undefined') return;
  initialized = true;
  const activePresses = new Map<number, ActivePress>();
  const releaseTimers = new Map<HTMLElement, number>();

  const removePressState = (element: HTMLElement) => {
    const timer = releaseTimers.get(element);
    if (timer !== undefined) window.clearTimeout(timer);
    releaseTimers.delete(element);
    element.classList.remove('is-pressing');
  };

  const clearAllPresses = () => {
    activePresses.clear();
    releaseTimers.forEach((_timer, element) => removePressState(element));
    document.querySelectorAll<HTMLElement>('.is-pressing')
      .forEach((element) => element.classList.remove('is-pressing'));
  };

  document.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    clearAllPresses();
    const element = findPressable(event.target);
    if (!element || element.matches(':disabled, [aria-disabled="true"]')) return;
    element.classList.add('is-pressing');
    activePresses.set(event.pointerId, {
      element,
      startX: event.clientX,
      startY: event.clientY,
    });
  }, { capture: true, passive: true });

  document.addEventListener('pointermove', (event) => {
    const press = activePresses.get(event.pointerId);
    if (!press) return;
    if (Math.hypot(event.clientX - press.startX, event.clientY - press.startY) <= MOVE_TOLERANCE_PX) return;
    removePressState(press.element);
    activePresses.delete(event.pointerId);
  }, { capture: true, passive: true });

  const release = (event: PointerEvent, immediate = false) => {
    const press = activePresses.get(event.pointerId);
    if (!press) return;
    activePresses.delete(event.pointerId);
    if (immediate) {
      removePressState(press.element);
      return;
    }
    const timer = window.setTimeout(() => {
      releaseTimers.delete(press.element);
      const stillPressed = [...activePresses.values()].some((active) => active.element === press.element);
      if (!stillPressed) press.element.classList.remove('is-pressing');
    }, RELEASE_VISIBLE_MS);
    releaseTimers.set(press.element, timer);
  };

  document.addEventListener('pointerup', (event) => release(event), { capture: true, passive: true });
  document.addEventListener('pointercancel', (event) => release(event, true), { capture: true, passive: true });
  document.addEventListener('lostpointercapture', (event) => release(event, true), { capture: true, passive: true });
  document.addEventListener('contextmenu', clearAllPresses, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') clearAllPresses();
  }, { capture: true, passive: true });
  window.addEventListener('blur', clearAllPresses, { passive: true });
  window.addEventListener('pagehide', clearAllPresses, { passive: true });
}
