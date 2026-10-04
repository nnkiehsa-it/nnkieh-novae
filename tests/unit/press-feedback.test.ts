import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { installPressFeedback } from "@/lib/press-feedback";
import { timingMs } from "@/lib/motion-timing";

let uninstall: () => void;
beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<div class="t-card"><a data-feed-card-link href="/issues/proposal-a/one"></a><button>Like</button></div><button disabled>Disabled</button>';
  uninstall = installPressFeedback();
});
afterEach(() => {
  uninstall();
  vi.useRealTimers();
  document.body.replaceChildren();
});

function pointer(type: string, target: EventTarget, properties = {}) {
  const event = new Event(type, { bubbles: true });
  Object.assign(event, { pointerType: "touch", pointerId: 1, isPrimary: true, button: 0, clientX: 20, clientY: 20 }, properties);
  target.dispatchEvent(event);
}

test("a stationary touch highlights the whole feed card after the touch delay", () => {
  const card = document.querySelector<HTMLElement>(".t-card")!;
  const link = card.querySelector("a")!;
  pointer("pointerdown", link);
  expect(card.dataset.pressed).toBeUndefined();
  vi.advanceTimersByTime(timingMs("touch"));
  expect(card.dataset.pressed).toBe("true");
  expect(link.hasAttribute("data-pressed")).toBe(false);
  pointer("pointerup", link);
  expect(card.dataset.pressed).toBeUndefined();
});

test("a quick tap or scrolling gesture never acquires a delayed highlight", () => {
  const link = document.querySelector("a")!;
  pointer("pointerdown", link);
  pointer("pointerup", link);
  vi.runAllTimers();
  expect(document.querySelector("[data-pressed]")).toBeNull();
  pointer("pointerdown", link);
  pointer("pointermove", link, { clientY: 29 });
  vi.runAllTimers();
  expect(document.querySelector("[data-pressed]")).toBeNull();
});

test("scroll, cancellation, a second finger and losing focus clear an active press", () => {
  const link = document.querySelector("a")!;
  for (const cancel of [
    () => document.dispatchEvent(new Event("scroll")),
    () => pointer("pointercancel", link),
    () => pointer("pointerdown", link, { pointerId: 2, isPrimary: false }),
    () => window.dispatchEvent(new Event("blur")),
  ]) {
    pointer("pointerdown", link);
    vi.advanceTimersByTime(timingMs("touch"));
    expect(document.querySelector("[data-pressed]")).not.toBeNull();
    cancel();
    expect(document.querySelector("[data-pressed]")).toBeNull();
  }
});

test("mouse presses are immediate and nested or disabled controls do not press the card", () => {
  const button = document.querySelector<HTMLElement>(".t-card button")!;
  pointer("pointerdown", button, { pointerType: "mouse" });
  expect(button.dataset.pressed).toBe("true");
  expect(document.querySelector(".t-card")!.hasAttribute("data-pressed")).toBe(false);
  pointer("pointerup", button, { pointerType: "mouse" });
  pointer("pointerdown", document.querySelector("button[disabled]")!);
  vi.runAllTimers();
  expect(document.querySelector("[data-pressed]")).toBeNull();
});
