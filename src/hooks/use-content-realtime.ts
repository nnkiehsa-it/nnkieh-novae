"use client";

import * as React from "react";

import {
  startContentRealtimeSession,
  stopContentRealtimeSession,
} from "@/services/realtime-events";

const CONTENT_REALTIME_ROUTE = /^\/(?:issues|facilities|announcements)(?:\/|$)/u;
const contentRealtimeEnabled =
  process.env.NEXT_PUBLIC_CONTENT_REALTIME_ENABLED !== "false";

export function useContentRealtime(pathname: string, enabled: boolean) {
  React.useEffect(() => {
    if (contentRealtimeEnabled && enabled && CONTENT_REALTIME_ROUTE.test(pathname)) {
      startContentRealtimeSession();
    } else {
      stopContentRealtimeSession();
    }
    return () => stopContentRealtimeSession();
  }, [enabled, pathname]);
}
