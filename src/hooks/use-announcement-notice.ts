"use client";

import * as React from "react";
import { useSession } from "@/hooks/use-session";
import { fetchAnnouncementUnreadHint } from "@/services/announcement-notice";
import { subscribeContentRealtimeEvents } from "@/services/realtime-events";
import { subscribeNotificationReadState } from "@/services/notifications";

export function useAnnouncementNotice() {
  const session = useSession();
  const [unread, setUnread] = React.useState(false);

  React.useEffect(() => {
    if (!session.user) {
      setUnread(false);
      return;
    }
    const refresh = () => {
      void fetchAnnouncementUnreadHint()
        .then(setUnread)
        .catch(() => undefined);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refresh();
    };

    refresh();
    const unsubscribeContent = subscribeContentRealtimeEvents(
      session.user.uid,
      (event) => {
        if (event.eventType === "announcement_changed" && event.op === "insert") {
          setUnread(true);
        }
      },
      refresh,
    );
    const unsubscribeState = subscribeNotificationReadState(
      session.user.uid,
      refresh,
      undefined,
      false,
      refresh,
    );
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      unsubscribeContent();
      unsubscribeState();
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [session.user]);

  return unread;
}
