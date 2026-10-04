import { interactiveTarget, isDisabledTarget } from "@/lib/interactive-target";
import { timingMs } from "@/lib/motion-timing";

/** One delegated press lifecycle, including controls rendered into portals. */
export function installPressFeedback() {
  const root = document.documentElement;
  let press: { target: HTMLElement; pointerId: number; x: number; y: number } | null = null;
  let timer: number | undefined;

  const clear = () => {
    window.clearTimeout(timer);
    timer = undefined;
    press?.target.removeAttribute("data-pressed");
    press = null;
  };
  const show = () => {
    if (press?.target.isConnected && !isDisabledTarget(press.target)) {
      press.target.dataset.pressed = "true";
    }
  };
  const onPointerDown = (event: PointerEvent) => {
    clear();
    root.dataset.pointerType = event.pointerType;
    if (!event.isPrimary || event.button !== 0) return;
    const control = interactiveTarget(event.target);
    if (!control || isDisabledTarget(control)) return;
    // Feed links cover the whole card. Its surface answers, rather than moving
    // the invisible link independently of the text and progress underneath it.
    const target = control.matches("[data-feed-card-link]")
      ? control.closest<HTMLElement>(".t-card")
      : control;
    if (!target) return;
    press = { target, pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    if (event.pointerType === "touch") {
      timer = window.setTimeout(show, timingMs("touch"));
    } else {
      show();
    }
  };
  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType === "mouse") root.dataset.pointerType = "mouse";
    if (!press || event.pointerId !== press.pointerId) return;
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) >= 8) clear();
  };
  const onPointerEnd = (event: PointerEvent) => {
    if (event.pointerId === press?.pointerId) clear();
  };
  const onVisibilityChange = () => {
    if (document.hidden) clear();
  };

  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("pointermove", onPointerMove, { capture: true, passive: true });
  document.addEventListener("pointerup", onPointerEnd, true);
  document.addEventListener("pointercancel", onPointerEnd, true);
  document.addEventListener("scroll", clear, { capture: true, passive: true });
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("blur", clear);
  window.addEventListener("pagehide", clear);
  return () => {
    clear();
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("pointermove", onPointerMove, true);
    document.removeEventListener("pointerup", onPointerEnd, true);
    document.removeEventListener("pointercancel", onPointerEnd, true);
    document.removeEventListener("scroll", clear, true);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("blur", clear);
    window.removeEventListener("pagehide", clear);
    delete root.dataset.pointerType;
  };
}
