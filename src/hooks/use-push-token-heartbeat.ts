"use client";

import * as React from "react";
import { useSession } from "@/hooks/use-session";
import { confirmCurrentPushToken } from "@/services/push-token-registration";

export function usePushTokenHeartbeat() {
  const session = useSession();
  const uid = session.user?.uid;

  React.useEffect(() => {
    if (!uid) return;
    void confirmCurrentPushToken(uid).catch(() => undefined);
  }, [uid]);
}
