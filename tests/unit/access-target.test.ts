import { act, createElement, useLayoutEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const location = vi.hoisted(() => ({ search: new URLSearchParams() }));
const writes = vi.hoisted(() => [] as string[]);
// The router: an address asked for stays pending until `commit` lands one.
const router = vi.hoisted(() => ({ listeners: new Set<() => void>(), pending: null as string | null }));
vi.mock("@/hooks/use-app-location", () => ({ useAppLocation: () => ({ pathname: "/", search: location.search }) }));
vi.mock("@/lib/app-navigation", () => {
  const request = (address: string) => {
    writes.push(address);
    router.pending = address;
    for (const listener of router.listeners) listener();
  };
  return {
    pendingAddress: () => router.pending,
    pushAddress: request,
    replaceAddress: request,
    requestedAddress: () => router.pending ?? `/?${location.search.toString()}`,
    subscribePendingAddress: (listener: () => void) => {
      router.listeners.add(listener);
      return () => router.listeners.delete(listener);
    },
  };
});

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

/** The router committing each of `searches`, drawn once they all have landed. */
async function commit(root: Root, ...searches: string[]) {
  await act(async () => {
    for (const search of searches) {
      location.search = new URLSearchParams(search);
      router.pending = null;
      for (const listener of router.listeners) listener();
    }
    root.render(createElement(Probe));
  });
}

afterEach(() => {
  router.pending = null;
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

  await commit(root, "scope=facility&facilityCategory=facility-a");
  expect(target[0]).toMatchObject({ facilityId: "facility-a", kind: "facility" });

  // Stepping back to where the choice was made shows that address again.
  await commit(root, "");
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

it("keeps a choice made a moment earlier that the router has not committed yet", async () => {
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(createElement(Probe)));
  await act(async () => view[1]("areas"));
  await act(async () => target[1]({ facilityId: "facility-a", issueId: "", kind: "facility" }));
  expect(writes.at(-1)).toContain("view=areas");
  expect(writes.at(-1)).toContain("scope=facility");
  expect(view[0]).toBe("areas");
  expect(target[0].kind).toBe("facility");
  await act(async () => root.unmount());
});

it("follows a quick Back that React draws in the same render as the push", async () => {
  location.search = new URLSearchParams("view=areas");
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(createElement(Probe)));
  await act(async () => view[1]("accounts"));
  expect(view[0]).toBe("accounts");
  await commit(root, "", "view=areas");
  expect(view[0]).toBe("areas");
  await act(async () => root.unmount());
});
