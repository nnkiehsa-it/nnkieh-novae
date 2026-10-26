import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Pane, useStepDirection } from "../../src/ui/pane";

let root: Root;
let host: HTMLDivElement;
const animate = vi.fn();

function Harness({ position, step }: { position: number | number[]; step: string }) {
  const direction = useStepDirection(step, position);
  return createElement(Pane, { direction, step }, createElement("output", null, String(direction)));
}

function render(step: string, position: number | number[]) {
  act(() => root.render(createElement(Harness, { position, step })));
  return Number(host.querySelector("output")!.textContent);
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Object.assign(HTMLElement.prototype, { animate, getAnimations: () => [] });
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as typeof window.matchMedia;
  animate.mockClear();
  host = document.createElement("div");
  host.style.setProperty("--motion-route-travel", "32px");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

it("stays still on the first view and slides toward whichever side the reader moved", () => {
  expect(render("issues", 0)).toBe(0);
  expect(animate).not.toHaveBeenCalled();

  expect(render("facilities", 2)).toBe(1);
  expect(animate).toHaveBeenLastCalledWith(
    [{ opacity: 0, translate: "32px 0" }, { opacity: 1, translate: "0 0" }],
    expect.objectContaining({ duration: 250 }),
  );

  expect(render("announcements", 1)).toBe(-1);
  expect(animate.mock.lastCall![0][0]).toEqual({ opacity: 0, translate: "-32px 0" });
  expect(animate).toHaveBeenCalledTimes(2);
});

it("compares a view before the category inside it", () => {
  render("issues:a", [0, 3]);
  expect(render("issues:b", [0, 1])).toBe(-1);
  expect(render("facilities:x", [1, 0])).toBe(1);
});

it("does not replay when the same view renders again", () => {
  render("issues", 0);
  render("facilities", 1);
  render("facilities", 1);
  expect(animate).toHaveBeenCalledOnce();
});

it("only fades for a reader who asked for less motion", () => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as typeof window.matchMedia;
  render("issues", 0);
  render("facilities", 1);
  expect(animate.mock.lastCall![0][0]).toEqual({ opacity: 0, translate: "0px 0" });
});
