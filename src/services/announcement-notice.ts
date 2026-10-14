import { readRequestTimeoutMs } from "@/lib/request";
import { queryClient } from "@/lib/query-client";
import { callAction } from "@/services/backend-action";
import { announcementKeys } from "@/services/announcements";

export async function fetchAnnouncementUnreadHint() {
  return (await callAction("getAnnouncementUnreadHint", {}, { timeoutMs: readRequestTimeoutMs })).hasUnread;
}

export async function markAnnouncementsOpened(openedThrough: string) {
  const result = await callAction("markAnnouncementsOpened", { openedThrough });
  queryClient.setQueryData(announcementKeys.unread(), false);
  return result;
}
