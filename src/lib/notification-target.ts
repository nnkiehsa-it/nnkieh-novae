import type { NotificationRecord } from "@/types";

export function notificationTargetPath(notification: NotificationRecord) {
  if (notification.type === "issue_deleted") return null;
  const query = notification.type.includes("comment")
    ? `?tab=comments${notification.comment_id ? `&comment=${encodeURIComponent(notification.comment_id)}` : ""}`
    : "";
  if (notification.target_type === "announcement") {
    return `/announcements/${encodeURIComponent(notification.target_id)}${query}`;
  }
  if (notification.target_type === "facility") {
    return `/facilities/${encodeURIComponent(notification.target_id)}`;
  }
  return `/issues/${encodeURIComponent(notification.issue_category ?? "my-proposals")}/${encodeURIComponent(notification.target_id)}${query}`;
}
