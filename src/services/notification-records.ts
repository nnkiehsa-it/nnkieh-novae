import { isIssueCategory } from "@/constants/categories";
import type { FacilityStatus, IssueStatus, NotificationRecord, NotificationSource, NotificationTargetType, NotificationType } from "@/types";
import { normalizeDate, normalizeStatus } from "./issues-core";
import { normalizeNotificationCursor, type NotificationCursor } from "./notification-cursor";

export interface NotificationSourcePage {
  cursor: NotificationCursor;
  hasMore: boolean;
  notifications: NotificationRecord[];
}

export interface NotificationReadState {
  admin: Date | null;
  announcement: Date | null;
  broadcast: Date | null;
  user: Date | null;
}

function normalizeNotificationType(value: unknown): NotificationType {
  if (value === "announcement_created" || value === "announcement_comment_created"
    || value === "facility_status_changed" || value === "facility_report_created"
    || value === "issue_created" || value === "issue_comment_created" || value === "issue_status_changed"
    || value === "support_goal_met" || value === "issue_deleted") return value;
  return "issue_comment_created";
}

function normalizeTargetType(value: unknown): NotificationTargetType {
  return value === "announcement" || value === "facility" ? value : "issue";
}

function normalizeNullableString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function normalizeOptionalStatus(value: unknown): IssueStatus | FacilityStatus | undefined {
  if (value === "unable-to-handle") return value;
  return typeof value === "string" ? normalizeStatus(value) : undefined;
}

export function normalizeNotificationRecord(source: NotificationSource, data: Record<string, unknown>): NotificationRecord {
  return {
    id: `${source}:${String(data.id ?? "")}`, source,
    type: normalizeNotificationType(data.type), target_type: normalizeTargetType(data.targetType),
    target_id: String(data.targetId ?? ""), comment_id: normalizeNullableString(data.commentId),
    title: String(data.title ?? ""), actor_uid: normalizeNullableString(data.actorUid),
    body_preview: normalizeNullableString(data.bodyPreview),
    issue_category: isIssueCategory(data.issueCategory) ? data.issueCategory : null,
    old_status: normalizeOptionalStatus(data.oldStatus), new_status: normalizeOptionalStatus(data.newStatus),
    is_read: Boolean(data.isRead), created_at: normalizeDate(data.createdAt),
  };
}

export function normalizeNotificationPage(source: NotificationSource, page: Record<string, unknown>): NotificationSourcePage {
  const records = Array.isArray(page.notifications) ? page.notifications : [];
  return {
    cursor: normalizeNotificationCursor(page.cursor), hasMore: page.hasMore === true,
    notifications: records.map((record) => normalizeNotificationRecord(source, record as Record<string, unknown>)),
  };
}

export function normalizeNotificationReadState(data: Record<string, unknown>): NotificationReadState {
  return {
    admin: normalizeDate(data.adminOpenedAt), announcement: normalizeDate(data.announcementOpenedAt),
    broadcast: normalizeDate(data.broadcastOpenedAt), user: normalizeDate(data.userOpenedAt),
  };
}
