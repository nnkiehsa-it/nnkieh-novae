import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useAppUpdate } from "@/hooks/use-app-update";

vi.mock("@/hooks/use-update-deferral", () => ({ useUpdateDeferral: () => true, hasUpdateDeferral: () => true }));

// A security check is on screen and work is unsaved, so only the check runs.
function AppUpdateProbe() {
  useAppUpdate(true);
  return null;
}

const key = "novae:last-version-check-at";
let root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  root = createRoot(document.createElement("div"));
});
afterEach(async () => {
  await act(async () => root.unmount());
  localStorage.clear();
  vi.unstubAllGlobals();
});

it("retries a failed version check on reconnection and retains successful throttling", async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockResolvedValueOnce(Response.json({ version: "development" }));
  vi.stubGlobal("fetch", fetch);
  await act(async () => root.render(createElement(AppUpdateProbe)));
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem(key)).toBeNull();
  await act(async () => window.dispatchEvent(new Event("online")));
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(localStorage.getItem(key)).not.toBeNull();
  await act(async () => window.dispatchEvent(new Event("online")));
  expect(fetch).toHaveBeenCalledTimes(2);
});

it("does not clear a newer check timestamp written by another tab", async () => {
  const otherTabTimestamp = String(Date.now() + 1_000);
  vi.stubGlobal("fetch", vi.fn(async () => {
    localStorage.setItem(key, otherTabTimestamp);
    throw new Error("offline");
  }));
  await act(async () => root.render(createElement(AppUpdateProbe)));
  expect(localStorage.getItem(key)).toBe(otherTabTimestamp);
});
