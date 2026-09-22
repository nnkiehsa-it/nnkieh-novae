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
