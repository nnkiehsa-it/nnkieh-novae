"use client";

import * as React from "react";
import { useSession } from "@/hooks/use-session";
import { fetchAnnouncementUnreadHint } from "@/services/announcement-notice";
import { subscribeContentRealtimeEvents } from "@/services/realtime-events";
import { subscribeNotificationReadState } from "@/services/notifications";
import { getViewMemory, setViewMemory } from "@/lib/view-memory-cache";

export function useAnnouncementNotice() {
  const session = useSession();
  const [unread, setUnread] = React.useState(() => getViewMemory<boolean>(session.user?.uid, "announcement-notice") ?? false);

  React.useEffect(() => {
    if (!session.user) {
      setUnread(false);
      return;
    }
    const uid = session.user.uid;
    let active = true;
    let revision = 0;
    setUnread(getViewMemory<boolean>(uid, "announcement-notice") ?? false);
    const apply = (value: boolean) => {
      setUnread(value);
      setViewMemory(uid, "announcement-notice", value, ["announcement-list-page|"]);
    };
    const refresh = () => {
      const request = ++revision;
      void fetchAnnouncementUnreadHint()
        .then((value) => { if (active && revision === request) apply(value); })
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
          revision += 1;
          apply(true);
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
      active = false;
      unsubscribeContent();
      unsubscribeState();
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [session.user]);

  return unread;
}
