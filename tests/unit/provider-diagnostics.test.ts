import { act, createElement, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useProviderDiagnostics } from "@/hooks/use-provider-diagnostics";
import { getProviderDiagnostics, type ProviderDiagnostic } from "@/services/operations-console";
import { clearViewMemoryScope } from "@/lib/view-memory-cache";

vi.mock("@/hooks/use-session", () => ({ useSession: () => ({ user: { uid: "providers-test" } }) }));
vi.mock("@/i18n", () => {
  const t = (key: string) => key;
  return { useI18n: () => ({ t }) };
});
vi.mock("@/services/operations-console", () => ({ getProviderDiagnostics: vi.fn() }));
let root: Root;
let state!: ReturnType<typeof useProviderDiagnostics>;
const result = (provider: string, id: string): ProviderDiagnostic => ({ provider, status: "available", checkedAt: "2026-10-08T00:00:00Z", data: [{ id }], nextCursor: id, until: 100_000_000 });
function Probe() {
  const current = useProviderDiagnostics();
  useEffect(() => { state = current; }, [current]);
  return null;
}
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  clearViewMemoryScope("providers-test");
  vi.mocked(getProviderDiagnostics).mockReset().mockImplementation(async ({ provider }) => result(provider, "initial"));
  root = createRoot(document.createElement("div"));
  await act(async () => root.render(createElement(Probe)));
});
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals(); });

it("coalesces identical diagnostics and prevents an older search from replacing the current result", async () => {
  let finishOld!: (value: ProviderDiagnostic) => void;
  vi.mocked(getProviderDiagnostics).mockImplementationOnce(() => new Promise((resolve) => { finishOld = resolve; }));
  let old!: Promise<void>;
  await act(async () => { state.setQuery("old"); });
  await act(async () => { old = state.load("logs"); void state.load("logs"); });
  expect(getProviderDiagnostics).toHaveBeenCalledTimes(3);
  await act(async () => { state.setQuery("new"); });
  await act(async () => { await state.load("logs"); });
  const newest = state.results.logs;
  await act(async () => { finishOld(result("logs", "obsolete")); await old; });
  expect(state.results.logs).toEqual(newest);
  expect(state.query).toBe("new");
  expect(state.busy("logs")).toBe(false);
});

it("keeps a failed log page's records and cursor available for retry", async () => {
  await act(async () => { await state.load("logs"); });
  const previous = state.results.logs;
  vi.mocked(getProviderDiagnostics).mockResolvedValueOnce({ provider: "logs", status: "unavailable", checkedAt: "", error: "provider-http-503" });
  await act(async () => { await state.load("logs", true); });
  expect(state.results.logs).toEqual(previous);
  expect(state.error).toBe("provider-http-503");
  await act(async () => { await state.load("logs", true); });
  expect(getProviderDiagnostics).toHaveBeenLastCalledWith({ provider: "logs", query: "", cursor: "initial", until: 100_000_000 });
  expect(state.error).toBe("");
});
