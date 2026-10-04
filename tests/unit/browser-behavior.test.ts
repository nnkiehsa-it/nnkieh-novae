import { afterEach, expect, test } from "vitest";
import { installBrowserBehavior } from "@/lib/browser-behavior";

let uninstall: (() => void) | undefined;
afterEach(() => {
  uninstall?.();
  document.body.replaceChildren();
});

function dispatch(target: EventTarget, type: string, properties = {}) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, properties);
  target.dispatchEvent(event);
  return event.defaultPrevented;
}

test("single-finger scrolling stays native while pinch and browser zoom are blocked", () => {
  uninstall = installBrowserBehavior();
  expect(dispatch(document, "touchmove", { touches: [{}] })).toBe(false);
  expect(dispatch(document, "touchstart", { touches: [{}, {}] })).toBe(true);
  expect(dispatch(document, "touchmove", { touches: [{}, {}] })).toBe(true);
  expect(dispatch(document, "gesturestart")).toBe(true);
  expect(dispatch(document, "gesturechange")).toBe(true);
  expect(dispatch(document, "wheel", { ctrlKey: false })).toBe(false);
  expect(dispatch(document, "wheel", { ctrlKey: true })).toBe(true);
  expect(dispatch(document, "keydown", { ctrlKey: true, key: "+" })).toBe(true);
  expect(dispatch(document, "keydown", { metaKey: true, key: "c" })).toBe(false);
});

test("app content rejects native menus, selection and drag, but editors keep them", () => {
  document.body.innerHTML = '<a href="/home"><img><span>Link</span></a><input><textarea></textarea><div contenteditable="true"><b>Draft</b></div>';
  uninstall = installBrowserBehavior();
  for (const type of ["contextmenu", "selectstart", "dragstart"]) {
    expect(dispatch(document.querySelector("a span")!, type)).toBe(true);
    for (const selector of ["input", "textarea", "[contenteditable] b"]) {
      expect(dispatch(document.querySelector(selector)!, type)).toBe(false);
    }
  }
  uninstall();
  expect(dispatch(document.querySelector("a")!, "contextmenu")).toBe(false);
});
