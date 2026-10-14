import type { NotificationRecord } from "@/types";

export function notificationTargetPath(notification: NotificationRecord) {
  if (notification.type === "issue_deleted") return null;
  const query = notification.type.includes("comment")
    ? `?tab=comments${notification.commentId ? `&comment=${encodeURIComponent(notification.commentId)}` : ""}`
    : "";
  if (notification.targetType === "announcement") {
    return `/announcements/${encodeURIComponent(notification.targetId)}${query}`;
  }
  if (notification.targetType === "facility") {
    return `/facilities/${encodeURIComponent(notification.targetId)}`;
  }
  return `/issues/${encodeURIComponent(notification.issueCategory ?? "my-proposals")}/${encodeURIComponent(notification.targetId)}${query}`;
}
