import type { AppDatabaseClient } from "../database/client.ts";
import { isInvalidFcmTokenError, sendFcmMessage, sendFcmTopicMessage } from "../shared/fcm.ts";
import { asRecord } from "../shared/http.ts";
import {
  markNotionPageDeleted,
  syncAdminAuditToNotion,
  syncAnnouncementCreatedToNotion,
  syncIssueCreatedToNotion,
  syncIssueResultUpdatedToNotion,
  syncIssueSupportToNotion,
  syncIssueStatusChangedToNotion,
  syncFacilityCreatedToNotion,
  syncFacilityStatusToNotion,
} from "../shared/notion.ts";
import { createFunctionLogger, type FunctionLogger } from "../shared/observability.ts";

interface OutboxEvent {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  target_id: string;
  target_type: string;
  actor_uid: string;
  notification_completed_at?: string | null;
  notion_completed_at?: string | null;
}

const NOTIFICATION_ID_NAMESPACE = "52c06670-c364-4c0f-82d9-8f18bb9f311e";
const ISSUE_STATUS_LABELS: Record<string, string> = {
  "auto-rejected": "未通過",
  "completed": "已完成",
  "infeasible": "無法實行",
  "pending": "未回覆",
  "processing": "處理中",
  "review-rejected": "審核未通過",
  "under-review": "待審核",
  "unable-to-handle": "無法處理",
};
type AppDatabase = AppDatabaseClient;

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => asString(item)).filter(Boolean) : [];
}

function preview(value: unknown) {
  const text = asString(value).replace(/\s+/gu, " ").trim();
  return text.slice(0, 80);
}

function issueStatusLabel(status: string) {
  return ISSUE_STATUS_LABELS[status] ?? status;
}

function isCommentNotificationType(type: string) {
  return type === "issue_comment_created" || type === "announcement_comment_created";
}

function isIssueUpdateNotificationType(type: string) {
  return type === "issue_created"
    || type === "issue_status_changed"
    || type === "facility_status_changed"
    || type === "issue_deleted"
    || type === "support_goal_met";
}

function commentIdForEvent(event: OutboxEvent) {
  if (event.event_type !== "issue.comment_created" && event.event_type !== "announcement.comment_created") {
    return null;
  }
  return asString(event.payload.comment_id) || asString(event.payload.id) || null;
}

async function hydrateCommentContent(database: AppDatabase, event: OutboxEvent) {
  if (
    event.payload.content
    || (event.event_type !== "issue.comment_created" && event.event_type !== "announcement.comment_created")
  ) return;
  const commentId = commentIdForEvent(event);
  if (!commentId) return;
  const table = event.event_type === "issue.comment_created" ? "comments" : "announcement_comments";
  const { data, error } = await database.table("app_private", table)
    .select("content").eq("id", commentId).maybeSingle();
  if (error) throw error;
  if (data?.content) event.payload.content = String(data.content);
}

function notificationForEvent(event: OutboxEvent): Record<string, unknown> | null {
  if (event.payload.retention_cleanup === true) return null;
  const title = asString(event.payload.title, event.event_type);
  if (event.event_type === "issue.created") {
    return {
      source: "user", type: "issue_created", target_type: "issue", target_id: event.target_id,
      title: "收到新的提案", actor_uid: event.actor_uid,
      body_preview: title, issue_category: asString(event.payload.category),
    };
  }
  if (event.event_type === "facility.created") {
    return {
      source: "user", type: "facility_report_created", target_type: "facility", target_id: event.target_id,
      title: "新的設備報修", actor_uid: event.actor_uid,
      body_preview: title,
    };
  }
  if (event.event_type === "facility.status_changed") {
    const newStatus = asString(event.payload.new_status);
    return {
      source: "user", type: "facility_status_changed", target_type: "facility", target_id: event.target_id,
      title: "設備狀態已變更", actor_uid: event.actor_uid,
      body_preview: `${title} 現在狀態為 ${issueStatusLabel(newStatus)}`,
      old_status: asString(event.payload.old_status), new_status: newStatus,
    };
  }
  if (event.event_type === "issue.comment_created") {
    return {
      source: "user",
      type: "issue_comment_created",
      target_type: "issue",
      target_id: event.target_id,
      comment_id: commentIdForEvent(event),
      title: "收到新留言",
      actor_uid: event.actor_uid,
      body_preview: preview(event.payload.content),
      issue_category: asString(event.payload.issue_category),
    };
  }
  if (event.event_type === "support.goal_met") {
    return {
      source: "user",
      type: "support_goal_met",
      target_type: "issue",
      target_id: event.target_id,
      title: "提案已達附議門檻",
      actor_uid: event.actor_uid,
      body_preview: title,
      issue_category: asString(event.payload.issue_category),
    };
  }
  if (event.event_type === "issue.status_changed") {
    const oldStatus = asString(event.payload.old_status);
    const newStatus = asString(event.payload.new_status);
    const isReviewApproved = oldStatus === "under-review" && newStatus === "pending";
    return {
      source: "user",
      type: "issue_status_changed",
      target_type: "issue",
      target_id: event.target_id,
      title: isReviewApproved ? "提案審核已通過" : "提案狀態已變更",
      actor_uid: event.actor_uid,
      body_preview: isReviewApproved
        ? `${title} 已通過審核並開放附議。`
        : `${title} 現在狀態為 ${issueStatusLabel(newStatus)}`,
      old_status: oldStatus,
      new_status: newStatus,
      issue_category: asString(event.payload.issue_category),
    };
  }
  if (event.event_type === "issue.deleted") {
    return {
      source: "user",
      type: "issue_deleted",
      target_type: "issue",
      target_id: event.target_id,
      title: "提案已被刪除",
      actor_uid: event.actor_uid,
      body_preview: title,
    };
  }
  if (event.event_type === "announcement.created") {
    return {
      source: "broadcast",
      type: "announcement_created",
      target_type: "announcement",
      target_id: event.target_id,
      title: "有新的公告",
      actor_uid: event.actor_uid,
      body_preview: title,
    };
  }
  if (event.event_type === "announcement.comment_created") {
    return {
      source: "user",
      type: "announcement_comment_created",
      target_type: "announcement",
      target_id: event.target_id,
      comment_id: commentIdForEvent(event),
      title: "收到新留言",
      actor_uid: event.actor_uid,
      body_preview: preview(event.payload.content),
    };
  }
  return null;
}

function uuidToBytes(uuid: string) {
  return Uint8Array.from(uuid.replace(/-/gu, "").match(/.{2}/gu)?.map((byte) => parseInt(byte, 16)) ?? []);
}

function bytesToUuid(bytes: Uint8Array) {
  const hex = Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

async function deterministicNotificationId(eventId: string, kind: string) {
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

async function findIssueAuthorUid(
  database: AppDatabase,
  event: OutboxEvent,
) {
  const replyRecipientUid = asString(event.payload.parent_author_uid);
  if (replyRecipientUid) return replyRecipientUid;

  const payloadAuthorUid = asString(event.payload.issue_author_uid)
    || asString(event.payload.author_uid);
  if (payloadAuthorUid) return payloadAuthorUid;

  const { data, error } = await database
    .table("app_private", "issues")
    .select("author_uid")
    .eq("id", event.target_id)
    .maybeSingle();
  if (error) throw error;
  return asString(data?.author_uid);
}

async function findAnnouncementCommentRecipientUid(
  database: AppDatabase,
  event: OutboxEvent,
) {
  const replyRecipientUid = asString(event.payload.parent_author_uid);
  if (replyRecipientUid) return replyRecipientUid;

  const payloadAuthorUid = asString(event.payload.announcement_author_uid);
  if (payloadAuthorUid) return payloadAuthorUid;

  const { data, error } = await database
    .table("app_private", "announcements")
    .select("author_uid")
    .eq("id", event.target_id)
    .maybeSingle();
  if (error) throw error;
  return asString(data?.author_uid);
}

async function findDisplayName(database: AppDatabase, uid: string) {
  if (!uid) return "";
  const { data, error } = await database
    .table("app_private", "user_profiles")
    .select("display_name")
    .eq("uid", uid)
    .maybeSingle();
  if (error) throw error;
  return asString(data?.display_name);
}

async function resolveNotification(
  database: AppDatabase,
  event: OutboxEvent,
) {
  const notification = notificationForEvent(event);
  if (!notification) return null;

  if (event.event_type === "issue.comment_created") {
    const recipientUid = await findIssueAuthorUid(database, event);
    if (!recipientUid) return null;
    if (recipientUid === event.actor_uid) return null;
    return { ...notification, recipient_uid: recipientUid };
  }

  if (event.event_type === "announcement.comment_created") {
    const recipientUid = await findAnnouncementCommentRecipientUid(database, event);
    if (!recipientUid || recipientUid === event.actor_uid) return null;
    return { ...notification, recipient_uid: recipientUid };
  }

  return notification;
}

async function markMappedNotionPageDeleted(
  database: AppDatabase,
  targetType: string,
  targetId: string,
) {
  const { data, error } = await database
    .table("app_private", "notion_pages")
    .select("notion_page_id")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .maybeSingle();
  if (error) throw error;
  if (data?.notion_page_id) {
    const pageId = String(data.notion_page_id);
    if (pageId.startsWith("pending:")) throw new Error("notion-sync-in-progress");
    await markNotionPageDeleted(pageId);
    const { error: deleteError } = await database
      .table("app_private", "notion_pages")
      .delete()
      .eq("target_type", targetType)
      .eq("target_id", targetId);
    if (deleteError) throw deleteError;
  }
}

async function forgetMappedNotionPage(
  database: AppDatabase,
  targetType: string,
  targetId: string,
) {
  const { error } = await database
    .table("app_private", "notion_pages")
    .delete()
    .eq("target_type", targetType)
    .eq("target_id", targetId);
  if (error) throw error;
}

async function syncNotionForEvent(
  database: AppDatabase,
  event: OutboxEvent,
): Promise<void> {
  switch (event.event_type) {
    case "admin.audit_recorded":
      await syncAdminAuditToNotion(database, event.target_type, event.target_id, event.payload);
      break;
    case "issue.created":
      await syncIssueCreatedToNotion(database, event.target_id, event.payload);
      break;
    case "facility.created":
      await syncFacilityCreatedToNotion(database, event.target_id, event.payload);
      break;
    case "facility.status_changed":
      await syncFacilityStatusToNotion(database, event.target_id, event.payload);
      break;
    case "issue.status_changed":
      await syncIssueStatusChangedToNotion(database, event.target_id, event.payload);
      break;
    case "issue.result_updated":
      await syncIssueResultUpdatedToNotion(database, event.target_id, event.payload);
      break;
    case "support.goal_met":
      await syncIssueSupportToNotion(database, event.target_id);
      break;
    case "issue.deleted":
    case "announcement.deleted":
    case "facility.deleted": {
      if (event.payload.retention_cleanup === true) {
        await forgetMappedNotionPage(database, event.target_type, event.target_id);
      } else {
        await markMappedNotionPageDeleted(database, event.target_type, event.target_id);
      }
      break;
    }
    case "announcement.created":
    case "announcement.updated":
      await syncAnnouncementCreatedToNotion(database, event.target_id, event.payload);
      break;
    default:
      break;
  }
}

async function sendPushes(
  database: AppDatabase,
  notification: Record<string, unknown>,
  explicitRecipientUids: string[],
  log: FunctionLogger,
) {
  if (isCommentNotificationType(asString(notification.type))) {
    const actorName = await findDisplayName(database, asString(notification.actor_uid));
    notification = {
      ...notification,
      title: actorName ? `來自 ${actorName} 的留言` : "收到新留言",
    };
  }
  const source = asString(notification.source);
  const recipientUid = asString(notification.recipient_uid);
  const recipientUids = [...new Set(
    (explicitRecipientUids.length > 0 ? explicitRecipientUids : [recipientUid]).filter(Boolean),
  )];
  const notificationType = asString(notification.type);
  const topic = recipientUids.length === 0 && source === "broadcast" && notificationType === "announcement_created"
    ? "srp-broadcast"
    : "";
  const tokens: Array<{ token: string; uid: string }> = [];
  const seenTokens = new Set<string>();
  for (let offset = 0; ; offset += 200) {
    let query = database.table("app_private", "push_tokens")
      .select("uid,token,topic_broadcast").order("uid", { ascending: true }).order("device_id", { ascending: true })
      .range(offset, offset + 199);
    if (recipientUids.length === 1) query = query.eq("uid", recipientUids[0]);
    else if (recipientUids.length > 1) query = query.in("uid", recipientUids);
    if (topic === "srp-broadcast") query = query.eq("topic_broadcast", false);
    const { data, error } = await query;
    if (error) throw error;
    for (const row of data ?? []) {
      const token = asString(row.token);
      if (!token || seenTokens.has(token)) continue;
      seenTokens.add(token);
      tokens.push({ token, uid: asString(row.uid) });
    }
    if ((data ?? []).length < 200) break;
  }

  const targetType = asString(notification.target_type);
  const targetId = asString(notification.target_id);
  const commentId = asString(notification.comment_id);
  const category = asString(notification.issue_category);
  const isComment = isCommentNotificationType(notificationType);
  const commentQuery = isComment && commentId ? `&comment=${encodeURIComponent(commentId)}` : "";
  const link = notificationType === "issue_deleted"
    ? "/notifications"
    : targetType === "announcement"
    ? `/announcements/${encodeURIComponent(targetId)}${isComment ? `?tab=comments${commentQuery}` : ""}`
    : targetType === "facility"
    ? `/facilities/${encodeURIComponent(targetId)}`
    : category
    ? `/issues/${encodeURIComponent(category)}/${encodeURIComponent(targetId)}${isComment ? `?tab=comments${commentQuery}` : ""}`
    : "/notifications";
  const topicData = {
    body: asString(notification.body_preview), comment_id: commentId, issue_category: category, link,
    target_id: targetId, target_type: targetType, title: asString(notification.title),
    type: notificationType, view: isComment ? "comment" : "detail", tab: isComment ? "comments" : "details",
  };
  if (topic) {
    try {
      await sendFcmTopicMessage(topic, topicData);
    } catch (error) {
      log.error("push-topic.failed", error, { notificationType, topic });
      // Topic subscribers must be included in the token fallback when fanout fails.
      tokens.length = 0;
      for (let offset = 0; ; offset += 200) {
        let fallbackQuery = database.table("app_private", "push_tokens")
          .select("uid,token")
          .order("uid", { ascending: true })
          .order("device_id", { ascending: true })
          .range(offset, offset + 199);
        if (recipientUids.length === 1) fallbackQuery = fallbackQuery.eq("uid", recipientUids[0]);
        else if (recipientUids.length > 1) fallbackQuery = fallbackQuery.in("uid", recipientUids);
        const { data: fallbackTokens, error: fallbackError } = await fallbackQuery;
        if (fallbackError) throw fallbackError;
        for (const row of fallbackTokens ?? []) {
          if (!seenTokens.has(row.token)) {
            seenTokens.add(row.token);
            tokens.push({ token: row.token, uid: row.uid });
          }
        }
        if ((fallbackTokens ?? []).length < 200) break;
      }
    }
  }
  const tokenRecipientUids = [...new Set(tokens.map((row) => asString(row.uid)).filter(Boolean))];
  const preferences = new Map<string, { comments: boolean; facilityUpdates: boolean; issueUpdates: boolean }>();
  let transientPushFailure: unknown = null;
  if (tokenRecipientUids.length > 0) {
    const { data: states, error: stateError } = await database
      .table("app_private", "notification_states")
      .select("uid,push_comments_enabled,push_facility_updates_enabled,push_issue_updates_enabled")
      .in("uid", tokenRecipientUids);
    if (stateError) throw stateError;
    for (const state of states ?? []) {
      preferences.set(String(state.uid), {
        comments: state.push_comments_enabled !== false,
        facilityUpdates: state.push_facility_updates_enabled !== false,
        issueUpdates: state.push_issue_updates_enabled !== false,
      });
    }
  }

  const sendToken = async (row: { token: string; uid: string }) => {
    const uid = asString(row.uid);
    const preference = preferences.get(uid) ?? { comments: true, facilityUpdates: true, issueUpdates: true };
    const isComment = isCommentNotificationType(notificationType);
    const isIssueUpdate = isIssueUpdateNotificationType(notificationType);
    const isFacilityUpdate = notificationType === "facility_status_changed" || notificationType === "facility_report_created";
    if ((isComment && !preference.comments) || (isFacilityUpdate && !preference.facilityUpdates) || (isIssueUpdate && !isFacilityUpdate && !preference.issueUpdates)) return;

    const title = asString(notification.title);
    const body = asString(notification.body_preview);
    const view = isComment ? "comment" : "detail";
    const tab = isComment ? "comments" : "details";
    try {
      await sendFcmMessage({
        token: row.token,
        data: {
          body,
          comment_id: commentId,
          issue_category: category,
          link,
          target_id: targetId,
          target_type: targetType,
          title,
          type: notificationType,
          view,
          tab,
        },
      });
    } catch (error) {
      if (isInvalidFcmTokenError(error)) {
        await database.table("app_private", "push_tokens").delete().eq("token", row.token);
      } else {
        transientPushFailure ??= error;
      }
    }
  };
  for (let offset = 0; offset < tokens.length; offset += 20) {
    await Promise.all(tokens.slice(offset, offset + 20).map(sendToken));
  }
  if (transientPushFailure) throw transientPushFailure;
}

async function insertNotification(
  database: AppDatabase,
  notification: Record<string, unknown>,
) {
  const { error } = await database
    .table("app_private", "notifications")
    .insert(notification);
  if (!error) return true;
  if (error.code === "23505") return false;
  throw error;
}

async function deliverPushes(
  database: AppDatabase,
  deliveryKey: string,
  notification: Record<string, unknown>,
  recipientUids: string[],
  log: FunctionLogger,
) {
  const { data: delivery, error: insertError } = await database
    .table("app_private", "push_delivery_logs")
    .insert({
      attempt_count: 1,
      delivery_key: deliveryKey,
      locked_at: new Date().toISOString(),
      next_attempt_at: new Date().toISOString(),
      notification,
      notification_type: asString(notification.type),
      recipient_uids: recipientUids,
      status: "processing",
      target_id: asString(notification.target_id),
      target_type: asString(notification.target_type),
      token_uid: "",
    })
    .select("id")
    .maybeSingle();
  if (insertError?.code === "23505") return;
  if (insertError) throw insertError;
  if (!delivery) throw new Error("push-delivery-job-not-created");

  try {
    await sendPushes(database, notification, recipientUids, log);
    const { error: completeError } = await database.table("app_private", "push_delivery_logs")
      .update({
        locked_at: null,
        notification: null,
        recipient_uids: [],
        status: "sent",
        updated_at: new Date().toISOString(),
      })
      .eq("id", delivery.id);
    if (completeError) throw completeError;
  } catch (error) {
    const traceCode = crypto.randomUUID();
    log.error("push-delivery.failed", error, {
      deliveryKey,
      notificationType: asString(notification.type),
      traceCode,
    });
    const { error: failError } = await database.table("app_private", "push_delivery_logs").update({
      error_trace_id: traceCode,
      locked_at: null,
      next_attempt_at: new Date(Date.now() + 15_000).toISOString(),
      status: "failed",
      updated_at: new Date().toISOString(),
    }).eq("id", delivery.id);
    if (failError) throw failError;
    // Keep the owning outbox event retryable so the existing minute scheduler
    // wakes this worker again after the push delivery backoff becomes due.
    throw error;
  }
}

async function retryPushDeliveries(database: AppDatabase, log: FunctionLogger) {
  const { data, error } = await database.call("app_api", "claim_push_delivery_jobs", { batch_size: 10 });
  if (error) throw error;
  for (const job of data ?? []) {
    try {
      await sendPushes(
        database,
        asRecord(job.notification),
        Array.isArray(job.recipient_uids) ? job.recipient_uids.map((uid) => asString(uid)).filter(Boolean) : [],
        log,
      );
      const { error: completeError } = await database.call("app_api", "complete_push_delivery_job", { job_id: job.id });
      if (completeError) throw completeError;
    } catch (retryError) {
      const traceCode = crypto.randomUUID();
      log.error("push-delivery-retry.failed", retryError, {
        deliveryKey: asString(job.delivery_key),
        traceCode,
      });
      const { error: failError } = await database.call("app_api", "fail_push_delivery_job", { job_id: job.id, trace_id: traceCode });
      if (failError) throw failError;
    }
  }
  return (data ?? []).length;
}

async function insertNotifications(
  database: AppDatabase,
  notifications: Record<string, unknown>[],
) {
  if (notifications.length === 0) return;
  const { error } = await database
    .table("app_private", "notifications")
    .upsert(notifications, { ignoreDuplicates: true, onConflict: "id" });
  if (error) throw error;
}

async function createNotificationsForEvent(
  database: AppDatabase,
  event: OutboxEvent,
  log: FunctionLogger,
) {
  if (event.event_type === "issue.created" || event.event_type === "facility.created") {
    const base = notificationForEvent(event);
    if (!base) return { hasNotification: false };
    const isFacility = event.event_type === "facility.created";
    const categoryId = asString(event.payload[isFacility ? "category_id" : "category"]);
    const assignmentTable = isFacility
      ? "user_facility_category_assignments"
      : "user_issue_category_assignments";
    let query = database.table("app_private", assignmentTable).select("uid").eq("category_id", categoryId);
    if (isFacility) query = query.eq("notify_on_created", true);
    const { data, error } = await query;
    if (error) throw error;
    const recipients = [...new Set((data ?? []).map((row) => asString(row.uid)).filter((uid) => uid && uid !== event.actor_uid))];
    const notifications = await Promise.all(recipients.map(async (recipientUid) => ({
      ...base, recipient_uid: recipientUid, id: await deterministicNotificationId(event.id, recipientUid),
    })));
    await insertNotifications(database, notifications);
    if (recipients.length > 0) await deliverPushes(database, event.id, base, recipients, log);
    return { hasNotification: recipients.length > 0 };
  }
  if (event.event_type === "facility.status_changed") {
    const base = notificationForEvent(event);
    if (!base) return { hasNotification: false };
    const authorUid = asString(event.payload.author_uid);
    const { data, error } = await database.table("app_private", "facility_report_affected_users")
      .select("uid").eq("facility_id", event.target_id);
    if (error) throw error;
    const recipients = [...new Set([authorUid, ...(data ?? []).map((row) => asString(row.uid))].filter(Boolean))];
    const notifications = await Promise.all(recipients.map(async (recipientUid) => ({
      ...base,
      recipient_uid: recipientUid,
      id: await deterministicNotificationId(event.id, recipientUid),
    })));
    await insertNotifications(database, notifications);
    if (recipients.length > 0) await deliverPushes(database, event.id, base, recipients, log);
    return { hasNotification: recipients.length > 0 };
  }
  if (
    event.event_type === "issue.status_changed"
    || event.event_type === "support.goal_met"
    || event.event_type === "issue.deleted"
  ) {
    const base = notificationForEvent(event);
    if (!base) return { hasNotification: false };

    const authorUid = await findIssueAuthorUid(database, event);
    let supporterUids = asStringArray(event.payload.supporter_uids);
    if (event.event_type !== "issue.deleted") {
      const { data, error } = await database.table("app_private", "supports")
        .select("uid").eq("issue_id", event.target_id);
      if (error) throw error;
      supporterUids = (data ?? []).map((row) => asString(row.uid)).filter(Boolean);
    }

    const recipients = [...new Set([authorUid, ...supporterUids].filter(Boolean))]
      .filter((uid) => event.event_type === "support.goal_met" || uid !== event.actor_uid);
    const notifications = await Promise.all(recipients.map(async (recipientUid) => ({
        ...base,
        recipient_uid: recipientUid,
        id: await deterministicNotificationId(event.id, recipientUid),
      })));
    await insertNotifications(database, notifications);
    if (recipients.length > 0) await deliverPushes(database, event.id, base, recipients, log);
    return { hasNotification: recipients.length > 0 };
  }
  const notification = await resolveNotification(database, event);
  if (notification) {
    const notificationWithId = {
      ...notification,
      id: await deterministicNotificationId(event.id, "primary"),
    };
    await insertNotification(database, notificationWithId);
    await deliverPushes(database, event.id, notificationWithId, [], log);
  }

  return {
    hasNotification: Boolean(notification),
  };
}

async function processEvent(database: AppDatabase, event: OutboxEvent, log: FunctionLogger) {
  await hydrateCommentContent(database, event);
  let hasNotification: boolean;
  if (!event.notification_completed_at) {
    ({ hasNotification } = await createNotificationsForEvent(database, event, log));
    const { error } = await database.table("app_private", "outbox_events")
      .update({ notification_completed_at: new Date().toISOString() }).eq("id", event.id);
    if (error) throw error;
  } else {
    hasNotification = Boolean(notificationForEvent(event));
  }

  if (!event.notion_completed_at) {
    await syncNotionForEvent(database, event);
    const { error } = await database.table("app_private", "outbox_events")
      .update({ notion_completed_at: new Date().toISOString() }).eq("id", event.id);
    if (error) throw error;
  }

  if (hasNotification) return;

  if (
    event.event_type === "announcement.updated"
    || event.event_type === "announcement.deleted"
    || event.event_type === "issue.status_changed"
    || event.event_type === "issue.result_updated"
    || event.event_type === "support.goal_met"
    || event.event_type === "issue.created"
    || event.event_type === "issue.comment_created"
    || event.event_type === "issue.deleted"
    || event.event_type === "announcement.created"
    || event.event_type === "announcement.comment_created"
    || event.event_type === "facility.created"
    || event.event_type === "facility.status_changed"
    || event.event_type === "facility.deleted"
  ) {
    return;
  }

  throw new Error(`Outbox handler is not implemented for ${event.event_type}.`);
}

export async function processOutboxBatch(database: AppDatabaseClient) {
  const log = createFunctionLogger("outboxWorker");
  const retriedPushCount = await retryPushDeliveries(database, log);
  const { data, error } = await database.call("app_api", "claim_outbox_events", { batch_size: 10 });
  if (error) throw error;

  const events = (data ?? []) as OutboxEvent[];
  for (const event of events) {
    try {
      await processEvent(database, event, log);
      const { error: completeError } = await database.call("app_api", "complete_outbox_event", {
        event_id: event.id,
      });
      if (completeError) throw completeError;
    } catch (eventError) {
      const traceCode = crypto.randomUUID();
      log.error("outbox-event.failed", eventError, {
        eventId: event.id,
        eventType: event.event_type,
        notificationCompleted: Boolean(event.notification_completed_at),
        notionCompleted: Boolean(event.notion_completed_at),
        targetType: event.target_type,
        traceCode,
      });
      const { error: failError } = await database.call("app_api", "fail_outbox_event", {
        event_id: event.id,
        error_trace_id: traceCode,
      });
      if (failError) throw failError;
    }
  }

  const hasMore = events.length === 10 || retriedPushCount === 10;
  log.success("outbox-worker.completed", {
    hasMore,
    processedCount: events.length,
    retriedPushCount,
    status: 200,
  });
  return { hasMore, processedCount: events.length, retriedPushCount };
}
