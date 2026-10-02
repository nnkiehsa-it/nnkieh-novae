import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { useDraft, type Draft } from "@/hooks/use-draft";

it("preserves edits made while an earlier draft is being saved", async () => {
  vi.useFakeTimers();
  const previousActEnvironment = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const element = document.createElement("div");
  const root = createRoot(element);
  const source = { count: 1 };
  let draft: Draft<typeof source>;
  let finish!: (value: typeof source) => void;
  const save = () => new Promise<typeof source>((resolve) => { finish = resolve; });
  function Probe() { draft = useDraft({ source, save }); return null; }
  try {
    await act(async () => root.render(createElement(Probe)));
    await act(async () => draft.update({ count: 2 }));
    let pending!: Promise<void>;
    await act(async () => { pending = draft.submit(); });
    await act(async () => draft.update({ count: 3 }));
    await act(async () => { finish({ count: 2 }); await pending; });
    expect(draft!.value).toEqual({ count: 3 });
    expect(draft!.dirty).toBe(true);
    await act(async () => vi.runAllTimers());
    expect(draft!.status).toBe("dirty");
    await act(async () => draft.reset());
    expect(draft!.value).toEqual({ count: 2 });
  } finally {
    await act(async () => root.unmount());
    vi.useRealTimers();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
  }
});

it("ignores duplicate saves and stale estimates, and saves against the editing baseline", async () => {
  const previousActEnvironment = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const root = createRoot(document.createElement("div"));
  let source = { revision: 1, count: 1 };
  let draft!: Draft<typeof source>;
  let finish!: (impact: { details: Record<string, number>; totalEstimatedRows: number }) => void;
  const estimate = vi.fn(() => new Promise<{ details: Record<string, number>; totalEstimatedRows: number }>((resolve) => { finish = resolve; }));
  const save = vi.fn(async (value: typeof source, _reason: string, baseline: typeof source) => ({ ...value, revision: baseline.revision + 1 }));
  function Probe() { draft = useDraft({ source, save, estimate }); return null; }
  try {
    await act(async () => root.render(createElement(Probe)));
    await act(async () => draft.update({ count: 2 }));
    let pending!: Promise<void>;
    await act(async () => { pending = draft.submit(); void draft.submit(); });
    expect(estimate).toHaveBeenCalledTimes(1);
    await act(async () => draft.update({ count: 3 }));
    await act(async () => { finish({ details: { rows: 5 }, totalEstimatedRows: 5 }); await pending; });
    expect(draft.impact).toBeNull();
    expect(save).not.toHaveBeenCalled();
    source = { revision: 2, count: 4 };
    await act(async () => root.render(createElement(Probe)));
    expect(draft.baseline).toEqual({ revision: 1, count: 1 });
    await act(async () => { pending = draft.submit(); });
    await act(async () => { finish({ details: { rows: 5 }, totalEstimatedRows: 5 }); await pending; });
    await act(async () => { await Promise.all([draft.confirm(), draft.confirm()]); });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][2].revision).toBe(1);
    expect(draft.value).toEqual({ revision: 2, count: 3 });
  } finally {
    await act(async () => root.unmount());
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
  }
});
