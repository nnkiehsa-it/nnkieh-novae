"use client";

import * as React from "react";
import { useSession } from "@/hooks/use-session";
import { getViewMemory, setViewMemory } from "@/lib/view-memory-cache";
import {
  fetchNotificationUnreadHint,
  subscribeNotificationBadge,
} from "@/services/notifications";

export function useNotificationBadge() {
  const session = useSession();
  const [unread, setUnread] = React.useState(() => getViewMemory<boolean>(session.user?.uid, "notification-badge") ?? false);

  React.useEffect(() => {
    let active = true;
    let revision = 0;
    if (!session.user) return;
    const uid = session.user.uid;
    const remembered = getViewMemory<boolean>(uid, "notification-badge");
    setUnread(remembered ?? false);
    const apply = (value: boolean) => {
      setUnread(value);
      setViewMemory(uid, "notification-badge", value, ["notification-unread-hint"]);
    };
    const refresh = () => {
      const requestRevision = ++revision;
      void fetchNotificationUnreadHint({ forceRefresh: remembered !== null })
        .then((value) => { if (active && revision === requestRevision) apply(value); })
        .catch(() => undefined);
    };
    refresh();
    const unsubscribe = subscribeNotificationBadge(
      session.user.uid,
      session.isAdmin,
      () => { revision += 1; apply(true); },
      refresh,
    );
    return () => { active = false; unsubscribe(); };
  }, [session.isAdmin, session.user]);

  return unread;
}
