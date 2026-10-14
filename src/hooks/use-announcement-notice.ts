"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/hooks/use-session";
import { invalidate, queryClient } from "@/lib/query-client";
import { announcementKeys } from "@/services/announcements";
import { fetchAnnouncementUnreadHint } from "@/services/announcement-notice";
import { subscribeContentRealtimeEvents } from "@/services/realtime-events";
import { subscribeNotificationReadState } from "@/services/notifications";

/** Whether an announcement was published since this account last opened the list. */
export function useAnnouncementNotice() {
  const uid = useSession().user?.uid;
  const query = useQuery({
    enabled: Boolean(uid),
    queryKey: announcementKeys.unread(),
    queryFn: fetchAnnouncementUnreadHint,
    // Asked again whenever the tab returns: the answer is one cheap row.
    staleTime: 0,
  });

  React.useEffect(() => {
    if (!uid) return;
    const refresh = () => void invalidate(announcementKeys.unread());
    const unsubscribeContent = subscribeContentRealtimeEvents(
      uid,
      (event) => {
        if (event.eventType === "announcement_changed" && event.op === "insert") {
          queryClient.setQueryData(announcementKeys.unread(), true);
        }
      },
      refresh,
    );
    const unsubscribeState = subscribeNotificationReadState(uid, refresh, undefined, false, refresh);
    return () => {
      unsubscribeContent();
      unsubscribeState();
    };
  }, [uid]);

  return Boolean(uid) && query.data === true;
}
