import * as React from "react";
import { useSession } from "@/hooks/use-session";
import { confirmCurrentPushToken } from "@/services/push-token-registration";

export function usePushTokenHeartbeat() {
  const session = useSession();
  const uid = session.user?.uid;

  React.useEffect(() => {
    if (!uid) return;
    void confirmCurrentPushToken(uid).catch((error: unknown) => {
      console.warn("This device's push registration could not be confirmed.", error);
    });
  }, [uid]);
}
