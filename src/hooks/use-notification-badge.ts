import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/hooks/use-session";
import { invalidate } from "@/lib/query-client";
import {
  fetchNotificationUnreadHint,
  notificationKeys,
  subscribeNotificationBadge,
} from "@/services/notifications";

const UNREAD_HINT_MAX_AGE_MS = 2 * 60_000;

/** Whether a notification arrived that this account has not opened yet. */
export function useNotificationBadge() {
  const session = useSession();
  const uid = session.user?.uid;
  const query = useQuery({
    enabled: Boolean(uid),
    queryKey: notificationKeys.unread(),
    queryFn: fetchNotificationUnreadHint,
    staleTime: UNREAD_HINT_MAX_AGE_MS,
  });

  React.useEffect(() => {
    if (!uid) return;
    // A new notification marks the badge itself (see the notification service).
    const refresh = () => void invalidate(notificationKeys.unread());
    return subscribeNotificationBadge(uid, session.isAdmin, () => undefined, refresh);
  }, [session.isAdmin, uid]);

  return Boolean(uid) && query.data === true;
}
