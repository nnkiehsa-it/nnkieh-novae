import { readRequestTimeoutMs } from "@/lib/request";
import { invokeBackendAction } from "@/services/backend-action";

export async function fetchAnnouncementUnreadHint() {
  const fn = invokeBackendAction<Record<string, never>, { hasUnread: boolean }>(
    "getAnnouncementUnreadHint",
    { timeoutMs: readRequestTimeoutMs },
  );
  return (await fn({})).hasUnread === true;
}

export async function markAnnouncementsOpened(openedThrough: string) {
  const fn = invokeBackendAction<
    { openedThrough: string },
    { openedAt: string | null; success: boolean }
  >("markAnnouncementsOpened");
  return await fn({ openedThrough });
}
