"use client";

import * as React from "react";
import { SKELETON_REVEAL_DURATION_MS } from "@/lib/loading-timing";

export function useColdDataReveal(coldRead: boolean, loading: boolean) {
  const [reveal, setReveal] = React.useState(coldRead);

  React.useEffect(() => {
    if (!reveal || loading) return;
    const timeout = window.setTimeout(
      () => setReveal(false),
      SKELETON_REVEAL_DURATION_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [loading, reveal]);

  return reveal;
}
