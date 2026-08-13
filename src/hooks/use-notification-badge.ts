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
    if (!session.user) return;
    const refresh = () => {
      void fetchNotificationUnreadHint()
        .then(setUnread)
        .catch(() => undefined);
    };
    refresh();
    return subscribeNotificationBadge(
      session.user.uid,
      session.isAdmin,
      () => setUnread(true),
      refresh,
    );
  }, [session.isAdmin, session.user]);

  return unread;
}
