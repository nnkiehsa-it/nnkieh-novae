import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { useActionFeedback, ACTION_SUCCESS_HOLD_MS } from "@/hooks/use-action-feedback";

it("shares an in-flight action and returns before its success animation finishes", async () => {
  vi.useFakeTimers();
  const globals = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = globals.IS_REACT_ACT_ENVIRONMENT;
  globals.IS_REACT_ACT_ENVIRONMENT = true;
  const root = createRoot(document.createElement("div"));
  let feedback!: ReturnType<typeof useActionFeedback>;
  function Probe() { feedback = useActionFeedback(); return null; }
  try {
    await act(async () => root.render(createElement(Probe)));
    const action = vi.fn(async () => 42);
    await act(async () => {
      expect(await Promise.all([feedback.run(action), feedback.run(action)])).toEqual([42, 42]);
    });
    expect(action).toHaveBeenCalledOnce();
    expect(feedback.state).toBe("success");
    expect(feedback.busy).toBe(false);

    let finish!: () => void;
    let next!: Promise<void>;
    await act(async () => {
      next = feedback.run(() => new Promise<void>((resolve) => { finish = resolve; }));
    });
    await act(async () => { vi.advanceTimersByTime(ACTION_SUCCESS_HOLD_MS); });
    expect(feedback.state).toBe("loading");
    await act(async () => { finish(); await next; });
    expect(feedback.state).toBe("success");
  } finally {
    await act(async () => root.unmount());
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
    globals.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});
