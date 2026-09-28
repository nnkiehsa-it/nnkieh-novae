"use client";

import { useCallback, useEffect, useState } from "react";

type EntranceState =
  | { phase: "checking" | "ready"; error: "" }
  | { phase: "error"; error: string };

export function useLoginEntrance(
  enabled: boolean,
  prepare: () => Promise<string>,
) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<EntranceState>({ phase: "checking", error: "" });

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void prepare().then((error) => {
      if (!active) return;
      setState(error ? { phase: "error", error } : { phase: "ready", error: "" });
    });
    return () => { active = false; };
  }, [attempt, enabled, prepare]);

  const retry = useCallback(() => {
    setState({ phase: "checking", error: "" });
    setAttempt((value) => value + 1);
  }, []);

  return { ...state, retry };
}
