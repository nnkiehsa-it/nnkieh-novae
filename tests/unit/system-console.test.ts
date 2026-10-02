import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { useSystemConsole } from "@/hooks/use-system-console";
import { clearScheduledWork, fetchOperationsConsole, fetchOperationsQueue, retryOperationalWork } from "@/services/operations-console";

const runtime = vi.hoisted(() => ({ poll: undefined as (() => Promise<void>) | undefined }));
vi.mock("@/i18n", () => {
  const t = (key: string) => key;
  return { useI18n: () => ({ t }) };
});
vi.mock("@/hooks/use-session", () => ({ useSession: () => ({ user: { uid: "system-console-test" } }) }));
vi.mock("@/hooks/use-foreground-poll", () => ({ useForegroundPoll: (poll: () => Promise<void>) => { runtime.poll = poll; } }));
vi.mock("@/services/operations-console", () => ({
  clearOperationalErrors: vi.fn(), clearScheduledWork: vi.fn(), fetchOperationsConsole: vi.fn(),
  fetchOperationsQueue: vi.fn(), queueNotionArchiveRebuild: vi.fn(), retryOperationalWork: vi.fn(),
}));

it("keeps canonical retried work and counts when an older poll finishes, and serializes writes", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const root = createRoot(document.createElement("div"));
  const failed = { id: "retry-me", status: "failed" };
  const queued = { ...failed, status: "pending" };
  const before = { jobs: [failed], deliveries: [], capacity: [{ name: "issues" }] };
  vi.mocked(fetchOperationsConsole).mockResolvedValue(before as never);
  let finishPoll!: (snapshot: unknown) => void;
  vi.mocked(fetchOperationsQueue).mockImplementationOnce(() => new Promise((resolve) => { finishPoll = resolve as typeof finishPoll; }));
  const after = { jobs: [queued], deliveries: [{ destination: "notion", status: "pending", count: 1 }] };
  vi.mocked(fetchOperationsQueue).mockResolvedValueOnce(after as never);
  let finishRetry!: () => void;
  vi.mocked(retryOperationalWork).mockImplementationOnce(() => new Promise((resolve) => {
    finishRetry = () => resolve({ success: true });
  }));
  let state!: ReturnType<typeof useSystemConsole>;
  function Probe() { state = useSystemConsole(); return null; }
  try {
    await act(async () => root.render(createElement(Probe)));
    let poll!: Promise<void>;
    await act(async () => { poll = runtime.poll!(); });
    let retry!: Promise<void>;
    await act(async () => {
      retry = state.retry("job", failed.id);
      await state.retry("job", failed.id);
      await state.clearSchedules();
    });
    expect(retryOperationalWork).toHaveBeenCalledTimes(1);
    expect(clearScheduledWork).not.toHaveBeenCalled();
    expect(state.busy).toBe(true);
    await act(async () => { finishRetry(); await retry; });
    expect(state.snapshot).toEqual({ ...before, ...after });
    expect(state.busy).toBe(false);
    await act(async () => { finishPoll(before); await poll; });
    expect(state.snapshot?.jobs).toEqual([queued]);
    expect(state.snapshot?.deliveries).toEqual(after.deliveries);
    await act(async () => root.render(null));
    const refreshed = { ...after, capacity: [{ name: "announcements" }], databaseBytes: 2048, metrics: [] };
    vi.mocked(fetchOperationsConsole).mockResolvedValue(refreshed as never);
    await act(async () => root.render(createElement(Probe)));
    expect(fetchOperationsConsole).toHaveBeenCalledTimes(2);
    expect(state.snapshot).toEqual(refreshed);
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});
