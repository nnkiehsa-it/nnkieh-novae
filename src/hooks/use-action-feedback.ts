"use client";

import * as React from "react";

export const ACTION_SUCCESS_HOLD_MS = 500;

export function useActionFeedback() {
  const [state, setState] = React.useState<"idle" | "loading" | "success">(
    "idle",
  );

  const run = React.useCallback(async <T,>(action: () => Promise<T>) => {
    setState("loading");
    try {
      const result = await action();
      setState("success");
      await new Promise<void>((resolve) =>
        window.setTimeout(resolve, ACTION_SUCCESS_HOLD_MS),
      );
      return result;
    } finally {
      setState("idle");
    }
  }, []);

  return {
    busy: state !== "idle",
    run,
    state,
  };
}
