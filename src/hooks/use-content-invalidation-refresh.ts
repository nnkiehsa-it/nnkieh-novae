"use client";

import * as React from "react";
import { subscribeContentCacheInvalidations } from "@/services/content-read-cache";

export function useContentInvalidationRefresh(
  prefixes: readonly string[],
  refresh: () => void | Promise<void>,
) {
  const refreshRef = React.useRef(refresh);
  const queuedRef = React.useRef(false);

  React.useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  React.useEffect(() => {
    const unsubscribe = subscribeContentCacheInvalidations((invalidatedPrefix) => {
      if (!prefixes.some((prefix) => invalidatedPrefix.startsWith(prefix))) return;
      if (queuedRef.current) return;
      queuedRef.current = true;
      queueMicrotask(() => {
        queuedRef.current = false;
        void refreshRef.current();
      });
    });
    return () => {
      unsubscribe();
    };
  }, [prefixes]);
}
