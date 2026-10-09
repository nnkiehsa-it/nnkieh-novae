import { expect, it } from "vitest";
import { createNativeModalIsolation } from "@/components/ui/native-modal-isolation";

it("keeps native backdrop class tokens interactive while isolating and restoring nested pages", () => {
  const background = document.createElement("main");
  const lower = document.createElement("div");
  const upper = document.createElement("div");
  const backdrops = ["actions", "dialog", "sheet", "popup", "popover"].map((kind) => {
    const element = document.createElement("div");
    element.className = `${kind}-backdrop ${kind}-backdrop-unique backdrop-in`;
    element.inert = false;
    return element;
  });
  [background, lower, upper].forEach((node) => { node.inert = false; node.tabIndex = -1; });
  document.body.append(background, lower, ...backdrops, upper);
  const isolation = createNativeModalIsolation();
  try {
    isolation.update(lower);
    expect(background.inert).toBe(true);
    isolation.update(upper);
    expect(lower.inert).toBe(true);
    backdrops.forEach((node) => expect(node.inert).toBe(false));
    isolation.update(lower);
    expect(lower.inert).toBe(false);
    expect(lower.hasAttribute("aria-hidden")).toBe(false);
    expect(background.inert).toBe(true);
    isolation.restore();
    expect(background.inert).toBe(false);
    expect(background.hasAttribute("aria-hidden")).toBe(false);
  } finally {
    isolation.restore();
    [background, lower, upper, ...backdrops].forEach((node) => node.remove());
  }
});
