"use client";

import * as React from "react";

/** Serialize writes and prevent an old account's result from updating this view. */
export function useAdminMutation({ invalidate, isActive }: {
  invalidate: () => void;
  isActive: () => boolean;
}) {
  const owner = React.useRef<object | null>(null);
  const [busy, setBusy] = React.useState("");
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    setBusy("");
    setError("");
    return () => { owner.current = null; };
  }, [isActive]);

  const run = React.useCallback(async <T,>(key: string, write: () => Promise<T>, apply: (result: T) => void) => {
    if (owner.current || !isActive()) return null;
    const token = {};
    owner.current = token;
    invalidate();
    setBusy(key);
    setError("");
    try {
      const result = await write();
      if (owner.current !== token || !isActive()) return null;
      apply(result);
      return result;
    } catch (caught) {
      if (owner.current === token && isActive()) setError(caught instanceof Error ? caught.message : String(caught));
      throw caught;
    } finally {
      if (owner.current === token) {
        owner.current = null;
        if (isActive()) setBusy("");
      }
    }
  }, [invalidate, isActive]);

  const clearError = React.useCallback(() => setError(""), []);
  return { busy, clearError, error, run };
}
