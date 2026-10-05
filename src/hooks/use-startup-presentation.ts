"use client";

import { useEffect, useState } from "react";
import type { SessionState } from "@/hooks/session-state";

// Replay only phases the session actually reached. A fast restoration gets a
// brief, readable sequence; a slow one stays on its real pending phase.
const STEP_DURATION_MS = 80;
const READY_DURATION_MS = 100;
let completedStartupRun = -1;

export function useStartupPresentation({ startupRun, startupSteps }: Pick<SessionState, "startupRun" | "startupSteps">) {
  const [position, setPosition] = useState(() => ({
    run: startupRun,
    index: completedStartupRun === startupRun ? startupSteps.length - 1 : 0,
    settled: completedStartupRun === startupRun,
  }));
  const index = position.run === startupRun ? position.index : 0;
  const phase = startupSteps[index];
  const settled = position.run === startupRun && position.settled;
  const hasNext = index < startupSteps.length - 1;

  useEffect(() => {
    if (!hasNext && (phase !== "ready" || settled)) return;
    const timer = window.setTimeout(() => {
      if (!hasNext) completedStartupRun = startupRun;
      setPosition({
        run: startupRun,
        index: hasNext ? index + 1 : index,
        settled: !hasNext,
      });
    }, phase === "ready" ? READY_DURATION_MS : STEP_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [hasNext, index, phase, settled, startupRun]);

  return { phase, pending: hasNext || phase !== "ready" || !settled };
}
