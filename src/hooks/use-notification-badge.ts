"use client";

import * as React from "react";
import { useSession } from "@/hooks/use-session";
import {
  fetchNotificationUnreadHint,
  subscribeNotificationBadge,
} from "@/services/notifications";

export function useNotificationBadge() {
  const session = useSession();
  const [unread, setUnread] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    let revision = 0;
    setUnread(false);
    if (!session.user) return;
    const refresh = () => {
      const requestRevision = ++revision;
      void fetchNotificationUnreadHint()
        .then((value) => { if (active && revision === requestRevision) setUnread(value); })
        .catch(() => undefined);
    };
    refresh();
    const unsubscribe = subscribeNotificationBadge(
      session.user.uid,
      session.isAdmin,
      () => { revision += 1; setUnread(true); },
      refresh,
    );
    return () => { active = false; unsubscribe(); };
  }, [session.isAdmin, session.user]);

  return unread;
}
