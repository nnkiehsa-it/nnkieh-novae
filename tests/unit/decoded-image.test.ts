import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DecodedImage } from "@/components/ui/decoded-image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

let root: Root;
let container: HTMLDivElement;
const decode = vi.fn();

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(false);
  Object.defineProperty(HTMLImageElement.prototype, "decode", { configurable: true, value: decode });
  container = document.createElement("div");
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  vi.restoreAllMocks(); vi.unstubAllGlobals(); decode.mockReset();
});

it("keeps the avatar fallback and attachment hidden until decoding completes without a spinner", async () => {
  let finish!: () => void;
  decode.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
  await act(async () => root.render(createElement(Avatar, null,
    createElement(AvatarImage, { src: "/avatar.webp", alt: "User" }),
    createElement(AvatarFallback, null, "U"))));
  const image = container.querySelector("img")!;
  await act(async () => image.dispatchEvent(new Event("load")));
  expect(image.dataset.imageState).toBe("loading");
  expect(container.querySelector('[data-slot="avatar-fallback"]')?.textContent).toBe("U");
  expect(container.querySelector("svg")).toBeNull();
  await act(async () => finish());
  expect(image.dataset.imageState).toBe("ready");
});

it("decodes an already complete cache hit without waiting for another load event", async () => {
  vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
  vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(96);
  decode.mockResolvedValue(undefined);
  await act(async () => root.render(createElement(DecodedImage, { src: "/cached.webp", alt: "Cached" })));
  expect(container.querySelector("img")?.dataset.imageState).toBe("ready");
  expect(container.querySelector(".t-image-placeholder")).toBeNull();
});

it("ignores an old decode after the source changes and reports a broken new image", async () => {
  let finish!: () => void;
  decode.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
  await act(async () => root.render(createElement(DecodedImage, { src: "/old.webp", alt: "Image" })));
  await act(async () => container.querySelector("img")!.dispatchEvent(new Event("load")));
  await act(async () => root.render(createElement(DecodedImage, { src: "/new.webp", alt: "Image" })));
  await act(async () => finish());
  expect(container.querySelector("img")?.dataset.imageState).toBe("loading");
  decode.mockRejectedValueOnce(new Error("Corrupt image"));
  await act(async () => container.querySelector("img")!.dispatchEvent(new Event("load")));
  expect(container.querySelector("img")?.dataset.imageState).toBe("error");
});
