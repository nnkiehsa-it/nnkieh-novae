"use client";

import * as React from "react";

export const ACTION_SUCCESS_HOLD_MS = 1_000;

export function useActionFeedback() {
  const [state, setState] = React.useState<"idle" | "loading" | "success">(
    "idle",
  );
  const pending = React.useRef<Promise<unknown> | null>(null);
  const timer = React.useRef<number | undefined>(undefined);
  const mounted = React.useRef(false);

  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      window.clearTimeout(timer.current);
    };
  }, []);

  const run = React.useCallback(<T,>(action: () => Promise<T>): Promise<T> => {
    if (pending.current) return pending.current as Promise<T>;
    window.clearTimeout(timer.current);
    setState("loading");
    const task = Promise.resolve().then(action).then((result) => {
      if (mounted.current) {
        setState("success");
        timer.current = window.setTimeout(() => setState("idle"), ACTION_SUCCESS_HOLD_MS);
      }
      // Success feedback may linger, but data updates and navigation do not wait for it.
      return result;
    }, (error: unknown) => {
      if (mounted.current) setState("idle");
      throw error;
    }).finally(() => { pending.current = null; });
    pending.current = task;
    return task;
  }, []);

  return {
    busy: state === "loading",
    run,
    state,
  };
}
