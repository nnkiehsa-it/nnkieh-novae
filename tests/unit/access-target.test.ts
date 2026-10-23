import { act, createElement, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const location = vi.hoisted(() => ({ search: new URLSearchParams() }));
const writes = vi.hoisted(() => [] as string[]);
vi.mock("@/hooks/use-app-location", () => ({ useAppLocation: () => ({ search: location.search }) }));
vi.mock("@/lib/app-navigation", () => ({
  pushAddress: (address: string) => writes.push(address),
  replaceAddress: (address: string) => writes.push(address),
}));

const { useAccessTarget } = await import("@/hooks/use-access-target");
const { useAdminView } = await import("@/hooks/use-admin-view");

let target: ReturnType<typeof useAccessTarget>;
let view: ReturnType<typeof useAdminView<"accounts" | "areas">>;
function Probe() {
  const currentTarget = useAccessTarget();
  const currentView = useAdminView(["accounts", "areas"] as const);
  useLayoutEffect(() => { target = currentTarget; view = currentView; });
  return null;
}

afterEach(() => {
  writes.length = 0;
  location.search = new URLSearchParams();
});

it("applies a choice before the router commits its address, then follows the URL", async () => {
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(createElement(Probe)));
  expect(target[0].kind).toBe("issue");

  await act(async () => target[1]({ facilityId: "facility-a", issueId: "", kind: "facility" }));
  expect(writes.at(-1)).toContain("scope=facility");
  expect(target[0]).toMatchObject({ facilityId: "facility-a", kind: "facility" });

  location.search = new URLSearchParams("scope=facility&facilityCategory=facility-a");
  await act(async () => root.render(createElement(Probe)));
  expect(target[0]).toMatchObject({ facilityId: "facility-a", kind: "facility" });

  // Stepping back to where the choice was made shows that address again.
  location.search = new URLSearchParams();
  await act(async () => root.render(createElement(Probe)));
  expect(target[0].kind).toBe("issue");
  await act(async () => root.unmount());
});

it("switches an admin view on the click, not on the router's commit", async () => {
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(createElement(Probe)));
  expect(view[0]).toBe("accounts");
  await act(async () => view[1]("areas"));
  expect(view[0]).toBe("areas");
  expect(writes.at(-1)).toContain("view=areas");
  await act(async () => root.unmount());
});
