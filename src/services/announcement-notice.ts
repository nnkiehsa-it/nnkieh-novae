import { readRequestTimeoutMs } from "@/lib/request";
import { callAction } from "@/services/backend-action";

export async function fetchAnnouncementUnreadHint() {
  return (await callAction("getAnnouncementUnreadHint", {}, { timeoutMs: readRequestTimeoutMs })).hasUnread;
}

export async function markAnnouncementsOpened(openedThrough: string) {
  return await callAction("markAnnouncementsOpened", { openedThrough });
}
