import { asString } from "../shared/http.ts";
import type { EventDeliveryItem } from "./delivery-attempt.ts";

/**
 * What an event says when it reaches a person.
 *
 * A notification is the same words whether it arrives in the application, as a
 * push, or over the socket, so the words are written once here: the title, the
 * preview of the body, and the identifier that keeps one event from becoming
 * two notifications when a delivery is retried.
 */
const NOTIFICATION_ID_NAMESPACE = "52c06670-c364-4c0f-82d9-8f18bb9f311e";

const ISSUE_STATUS_LABELS: Record<string, string> = {
  "auto-rejected": "未通過",
  completed: "已完成",
  infeasible: "無法實行",
  pending: "未回覆",
  processing: "處理中",
  "review-rejected": "審核未通過",
  "under-review": "待審核",
  "unable-to-handle": "無法處理",
};
function issueStatusLabel(status: string) {
  return ISSUE_STATUS_LABELS[status] ?? status;
}
function preview(value: unknown) {
  const text = asString(value).replace(/\s+/gu, " ").trim();
  return text.slice(0, 80);
}
export function isCommentNotificationType(type: string) {
  return type === "issue_comment_created" || type === "announcement_comment_created";
}
function uuidToBytes(uuid: string) {
  return Uint8Array.from(
    uuid.replace(/-/gu, "").match(/.{2}/gu)?.map((byte) => parseInt(byte, 16)) ?? [],
  );
}
function bytesToUuid(bytes: Uint8Array) {
  const hex = Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
export async function deterministicNotificationId(eventId: string, kind: string) {
  const namespaceBytes = uuidToBytes(NOTIFICATION_ID_NAMESPACE);
  const nameBytes = new TextEncoder().encode(`${eventId}:${kind}`);
  const bytes = new Uint8Array(namespaceBytes.length + nameBytes.length);
  bytes.set(namespaceBytes);
  bytes.set(nameBytes, namespaceBytes.length);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-1", bytes));
  const uuidBytes = hash.slice(0, 16);
  uuidBytes[6] = (uuidBytes[6] & 0x0f) | 0x50;
  uuidBytes[8] = (uuidBytes[8] & 0x3f) | 0x80;
  return bytesToUuid(uuidBytes);
}
export function resolveNotificationPayload(item: EventDeliveryItem): Record<string, unknown> | null {
  const { event_type, aggregate_id, actor_uid, payload } = item;
  const title = asString(payload.title, event_type);

  if (event_type === "issue.created") {
    return {
      source: "user",
      type: "issue_created",
      target_type: "issue",
      target_id: aggregate_id,
      title: "收到新的提案",
      actor_uid,
      body_preview: title,
      issue_category: asString(payload.category),
    };
  }
  if (event_type === "facility.created") {
    return {
      source: "user",
      type: "facility_report_created",
      target_type: "facility",
      target_id: aggregate_id,
      title: "新的設備報修",
      actor_uid,
      body_preview: title,
    };
  }
  if (event_type === "facility.status_changed") {
    const newStatus = asString(payload.new_status);
    return {
      source: "user",
      type: "facility_status_changed",
      target_type: "facility",
      target_id: aggregate_id,
      title: "設備狀態已變更",
      actor_uid,
      body_preview: `${title} 現在狀態為 ${issueStatusLabel(newStatus)}`,
      old_status: asString(payload.old_status),
      new_status: newStatus,
    };
  }
  if (event_type === "issue.comment_created") {
    return {
      source: "user",
      type: "issue_comment_created",
      target_type: "issue",
      target_id: aggregate_id,
      comment_id: asString(payload.comment_id),
      title: "收到新留言",
      actor_uid,
      body_preview: preview(payload.content),
      issue_category: asString(payload.issue_category),
    };
  }
  if (event_type === "support.goal_met") {
    return {
      source: "user",
      type: "support_goal_met",
      target_type: "issue",
      target_id: aggregate_id,
      title: "提案已達附議門檻",
      actor_uid,
      body_preview: title,
      issue_category: asString(payload.issue_category),
    };
  }
  if (event_type === "issue.status_changed") {
    const oldStatus = asString(payload.old_status);
    const newStatus = asString(payload.new_status);
    const isReviewApproved = oldStatus === "under-review" && newStatus === "pending";
    return {
      source: "user",
      type: "issue_status_changed",
      target_type: "issue",
      target_id: aggregate_id,
      title: isReviewApproved ? "提案審核已通過" : "提案狀態已變更",
      actor_uid,
      body_preview: isReviewApproved
        ? `${title} 已通過審核並開放附議。`
        : `${title} 現在狀態為 ${issueStatusLabel(newStatus)}`,
      old_status: oldStatus,
      new_status: newStatus,
      issue_category: asString(payload.issue_category),
    };
  }
  if (event_type === "issue.deleted") {
    return {
      source: "user",
      type: "issue_deleted",
      target_type: "issue",
      target_id: aggregate_id,
      title: "提案已被刪除",
      actor_uid,
      body_preview: title,
    };
  }
  if (event_type === "announcement.created") {
    return {
      source: "broadcast",
      type: "announcement_created",
      target_type: "announcement",
      target_id: aggregate_id,
      title: "有新的公告",
      actor_uid,
      body_preview: title,
    };
  }
  if (event_type === "announcement.comment_created") {
    return {
      source: "user",
      type: "announcement_comment_created",
      target_type: "announcement",
      target_id: aggregate_id,
      comment_id: asString(payload.comment_id),
      title: "收到新留言",
      actor_uid,
      body_preview: preview(payload.content),
    };
  }
  return null;
}
export function notificationRealtimePayload(notification: Record<string, unknown>) {
  return {
    actorUid: notification.actor_uid ?? null,
    bodyPreview: notification.body_preview ?? null,
    commentId: notification.comment_id ?? null,
    createdAt: notification.created_at ?? new Date().toISOString(),
    id: notification.id,
    isRead: false,
    issueCategory: notification.issue_category ?? null,
    newStatus: notification.new_status ?? null,
    oldStatus: notification.old_status ?? null,
    origin: notification.origin,
    recipientUid: notification.recipient_uid ?? null,
    source: notification.source,
    targetId: notification.target_id,
    targetType: notification.target_type,
    title: notification.title,
    type: notification.type,
  };
}
