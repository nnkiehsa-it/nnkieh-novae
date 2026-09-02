import type { Env } from "../../types";
import type { AppDatabaseClient } from "../database/client.ts";
import { isInvalidFcmTokenError, sendFcmMessage } from "../shared/fcm.ts";
import { asRecord, asString } from "../shared/http.ts";
import { syncDomainEventToNotion } from "../shared/notion.ts";
import { createFunctionLogger } from "../shared/observability.ts";
import type { RealtimeDelivery } from "../../durable/realtime-hub.ts";

export interface EventDeliveryItem {
  delivery_id: string;
  event_id: string;
  operation_id: string;
  destination: string;
  attempt_count: number;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  actor_uid: string;
  occurred_at: string;
  payload: Record<string, unknown>;
  aggregate_version: number;
}

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

function isCommentNotificationType(type: string) {
  return type === "issue_comment_created" || type === "announcement_comment_created";
}

function isIssueUpdateNotificationType(type: string) {
  return (
    type === "issue_created" ||
    type === "issue_status_changed" ||
    type === "facility_status_changed" ||
    type === "issue_deleted" ||
    type === "support_goal_met"
  );
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

function resolveNotificationPayload(item: EventDeliveryItem): Record<string, unknown> | null {
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

function notificationRealtimePayload(notification: Record<string, unknown>) {
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

async function resolveRecipients(
  database: AppDatabaseClient,
  item: EventDeliveryItem,
): Promise<string[]> {
  const { event_type, aggregate_id, actor_uid, payload } = item;

  if (event_type === "issue.created" || event_type === "facility.created") {
    const isFacility = event_type === "facility.created";
    const categoryId = asString(payload[isFacility ? "category_id" : "category"]);
    const table = isFacility
      ? "user_facility_category_assignments"
      : "user_issue_category_assignments";
    let query = database.table("app_private", table).select("uid").eq("category_id", categoryId);
    if (isFacility) query = query.eq("notify_on_created", true);
    const { data } = await query;
    const uids: string[] = (data ?? []).map((row: any) => asString(row.uid)).filter((uid: string) => Boolean(uid && uid !== actor_uid));
    return [...new Set(uids)];
  }

  if (event_type === "facility.status_changed") {
    const authorUid = asString(payload.author_uid);
    const { data } = await database
      .table("app_private", "facility_report_affected_users")
      .select("uid")
      .eq("facility_id", aggregate_id);
    const affectedUids: string[] = [authorUid, ...(data ?? []).map((row: any) => asString(row.uid))].filter(Boolean);
    return [...new Set(affectedUids)];
  }

  if (event_type === "issue.status_changed" || event_type === "support.goal_met" || event_type === "issue.deleted") {
    let authorUid = asString(payload.author_uid);
    if (!authorUid) {
      const { data } = await database.table("app_private", "issues").select("author_uid").eq("id", aggregate_id).maybeSingle();
      authorUid = asString(data?.author_uid);
    }
    let supporterUids: string[] = [];
    if (event_type !== "issue.deleted") {
      const { data } = await database.table("app_private", "supports").select("uid").eq("issue_id", aggregate_id);
      supporterUids = (data ?? []).map((row: any) => asString(row.uid)).filter(Boolean);
    }
    return [...new Set([authorUid, ...supporterUids].filter(Boolean))].filter(
      (uid) => event_type === "support.goal_met" || uid !== actor_uid,
    );
  }

  if (event_type === "issue.comment_created") {
    const parentCommentId = asString(payload.parent_comment_id);
    let parentAuthorUid = asString(payload.parent_author_uid);
    if (!parentAuthorUid && parentCommentId) {
      const { data } = await database.table("app_private", "comments").select("author_uid").eq("id", parentCommentId).maybeSingle();
      parentAuthorUid = asString(data?.author_uid);
    }
    if (parentAuthorUid && parentAuthorUid !== actor_uid) return [parentAuthorUid];
    const { data } = await database.table("app_private", "issues").select("author_uid").eq("id", aggregate_id).maybeSingle();
    const issueAuthorUid = asString(data?.author_uid);
    return issueAuthorUid && issueAuthorUid !== actor_uid ? [issueAuthorUid] : [];
  }

  if (event_type === "announcement.comment_created") {
    const parentCommentId = asString(payload.parent_comment_id);
    let parentAuthorUid = asString(payload.parent_author_uid);
    if (!parentAuthorUid && parentCommentId) {
      const { data } = await database.table("app_private", "announcement_comments").select("author_uid").eq("id", parentCommentId).maybeSingle();
      parentAuthorUid = asString(data?.author_uid);
    }
    if (parentAuthorUid && parentAuthorUid !== actor_uid) return [parentAuthorUid];
    const { data } = await database.table("app_private", "announcements").select("author_uid").eq("id", aggregate_id).maybeSingle();
    const annAuthorUid = asString(data?.author_uid);
    return annAuthorUid && annAuthorUid !== actor_uid ? [annAuthorUid] : [];
  }

  return [];
}

export async function processNotionDeliveries(database: AppDatabaseClient) {
  const log = createFunctionLogger("processNotionDeliveries");
  const { data, error } = await database.call("app_api", "claim_event_deliveries", {
    target_destination: "notion",
    batch_size: 10,
  });
  if (error) throw error;
  const items = (data ?? []) as EventDeliveryItem[];

  for (const item of items) {
    const attemptId = crypto.randomUUID();
    try {
      await syncDomainEventToNotion(database, {
        event_id: item.event_id,
        event_type: item.event_type,
        aggregate_type: item.aggregate_type,
        aggregate_id: item.aggregate_id,
        actor_uid: item.actor_uid,
        occurred_at: item.occurred_at,
        payload: item.payload,
      });
      await database.call("app_api", "complete_event_delivery", {
        delivery_id: item.delivery_id,
        attempt_id: attemptId,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error("notion-delivery.failed", err, {
        deliveryId: item.delivery_id,
        eventId: item.event_id,
        attemptId,
        eventType: item.event_type,
      });
      await database.call("app_api", "fail_event_delivery", {
        delivery_id: item.delivery_id,
        attempt_id: attemptId,
        error_info: { message },
      });
    }
  }

  return { hasMore: items.length === 10, processedCount: items.length };
}

export async function processInAppDeliveries(database: AppDatabaseClient, env: Env) {
  const log = createFunctionLogger("processInAppDeliveries");
  const { data, error } = await database.call("app_api", "claim_event_deliveries", {
    target_destination: "in_app",
    batch_size: 20,
  });
  if (error) throw error;
  const items = (data ?? []) as EventDeliveryItem[];

  for (const item of items) {
    const attemptId = crypto.randomUUID();
    try {
      const base = resolveNotificationPayload(item);
      const realtimeNotifications: RealtimeDelivery[] = [];
      if (base) {
        if (base.source === "broadcast") {
          const id = await deterministicNotificationId(item.event_id, "broadcast");
          const notification = { ...base, recipient_uid: null, origin: "live" as const, created_at: item.occurred_at, id };
          await database.table("app_private", "notifications").upsert([notification], {
            ignoreDuplicates: true,
            onConflict: "id",
          });
          realtimeNotifications.push({
            event: "notification_insert",
            id,
            payload: notificationRealtimePayload(notification),
            topic: `notifications:${String(base.source)}`,
          });
        } else {
          const recipients = await resolveRecipients(database, item);
          if (recipients.length > 0) {
            const notifications = await Promise.all(
              recipients.map(async (recipientUid) => ({
                ...base,
                recipient_uid: recipientUid,
                origin: "live" as const,
                created_at: item.occurred_at,
                id: await deterministicNotificationId(item.event_id, recipientUid),
              })),
            );
            await database.table("app_private", "notifications").upsert(notifications, {
              ignoreDuplicates: true,
              onConflict: "id",
            });
            realtimeNotifications.push(...notifications.map((notification) => ({
              event: "notification_insert",
              id: notification.id,
              payload: notificationRealtimePayload(notification),
              topic: `notifications:user:${notification.recipient_uid}`,
            })));
          }
        }
      }
      if (realtimeNotifications.length > 0) {
        await env.REALTIME.getByName("global").publish(realtimeNotifications);
      }
      await database.call("app_api", "complete_event_delivery", {
        delivery_id: item.delivery_id,
        attempt_id: attemptId,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error("in-app-delivery.failed", err, {
        deliveryId: item.delivery_id,
        eventId: item.event_id,
        attemptId,
      });
      await database.call("app_api", "fail_event_delivery", {
        delivery_id: item.delivery_id,
        attempt_id: attemptId,
        error_info: { message },
      });
    }
  }

  return { hasMore: items.length === 20, processedCount: items.length };
}

export async function processPushDeliveries(database: AppDatabaseClient) {
  const log = createFunctionLogger("processPushDeliveries");
  const { data, error } = await database.call("app_api", "claim_event_deliveries", {
    target_destination: "push",
    batch_size: 20,
  });
  if (error) throw error;
  const items = (data ?? []) as EventDeliveryItem[];

  for (const item of items) {
    const attemptId = crypto.randomUUID();
    try {
      const notification = resolveNotificationPayload(item);
      if (notification) {
        const recipients = await resolveRecipients(database, item);
        const source = asString(notification.source);
        const notificationType = asString(notification.type);
        const broadcast = recipients.length === 0 && source === "broadcast" && notificationType === "announcement_created";

        let eligibleRecipients = recipients;
        if (recipients.length > 0) {
          const isComment = isCommentNotificationType(notificationType);
          const prefColumn = isComment
            ? "push_comments_enabled"
            : item.aggregate_type === "facility"
            ? "push_facility_updates_enabled"
            : item.aggregate_type === "issue"
            ? "push_issue_updates_enabled"
            : null;
          if (prefColumn) {
            let prefQuery = database.table("app_private", "notification_states").select(`uid,${prefColumn}`);
            if (recipients.length === 1) prefQuery = prefQuery.eq("uid", recipients[0]);
            else prefQuery = prefQuery.in("uid", recipients);
            const { data: prefRows } = await prefQuery;
            const disabledUids = new Set(
              (prefRows ?? []).filter((r: any) => r[prefColumn] === false).map((r: any) => asString(r.uid)),
            );
            eligibleRecipients = recipients.filter((uid) => !disabledUids.has(uid));
          }
        }

        const tokens: Array<{ token: string; uid: string }> = [];
        const seenTokens = new Set<string>();
        if (eligibleRecipients.length > 0 || broadcast) {
          for (let offset = 0; ; offset += 200) {
            let query = database.table("app_private", "push_tokens")
              .select("uid,token")
              .order("uid", { ascending: true })
              .order("device_id", { ascending: true })
              .range(offset, offset + 199);
            if (eligibleRecipients.length === 1) query = query.eq("uid", eligibleRecipients[0]);
            else if (eligibleRecipients.length > 1) query = query.in("uid", eligibleRecipients);
            const { data: tokenRows } = await query;
            for (const row of tokenRows ?? []) {
              const token = asString(row.token);
              if (!token || seenTokens.has(token)) continue;
              seenTokens.add(token);
              tokens.push({ token, uid: asString(row.uid) });
            }
            if ((tokenRows ?? []).length < 200) break;
          }
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
          body: asString(notification.body_preview),
          comment_id: commentId,
          issue_category: category,
          link,
          target_id: targetId,
          target_type: targetType,
          title: asString(notification.title),
          type: notificationType,
          view: isComment ? "comment" : "detail",
          tab: isComment ? "comments" : "details",
        };

        for (const tokenRow of tokens) {
          try {
            await sendFcmMessage({
              token: tokenRow.token,
              data: topicData,
            });
          } catch (err) {
            if (isInvalidFcmTokenError(err)) {
              await database.table("app_private", "push_tokens").delete().eq("token", tokenRow.token);
            } else {
              throw err;
            }
          }
        }
      }

      await database.call("app_api", "complete_event_delivery", {
        delivery_id: item.delivery_id,
        attempt_id: attemptId,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error("push-delivery.failed", err, {
        deliveryId: item.delivery_id,
        eventId: item.event_id,
        attemptId,
      });
      await database.call("app_api", "fail_event_delivery", {
        delivery_id: item.delivery_id,
        attempt_id: attemptId,
        error_info: { message },
      });
    }
  }

  return { hasMore: items.length === 20, processedCount: items.length };
}

function contentEventType(eventType: string) {
  if (eventType === "support.goal_met" || eventType === "support.toggled") return "issue_support_changed";
  if (eventType === "issue.comment_created" || eventType === "issue.comment_deleted") return "issue_comment_changed";
  if (eventType.startsWith("issue.")) return "issue_changed";
  if (eventType === "announcement.liked") return "announcement_metrics_changed";
  if (eventType === "announcement.comment_created" || eventType === "announcement.comment_deleted") return "announcement_comment_changed";
  if (eventType.startsWith("announcement.")) return "announcement_changed";
  if (eventType.startsWith("facility.")) return "facility_changed";
  return null;
}

async function realtimeDeliveriesForItem(
  database: AppDatabaseClient,
  item: EventDeliveryItem,
): Promise<RealtimeDelivery[]> {
  if (item.event_type === "notification.marked_opened") {
    const { data, error } = await database.table("app_private", "notification_states")
      .select("admin_opened_at,broadcast_opened_at,user_opened_at,push_comments_enabled,push_facility_updates_enabled,push_issue_updates_enabled")
      .eq("uid", item.aggregate_id)
      .maybeSingle();
    if (error) throw error;
    return [{
      event: "notification_state_changed",
      id: item.event_id,
      payload: {
        adminOpenedAt: data?.admin_opened_at ?? null,
        broadcastOpenedAt: data?.broadcast_opened_at ?? null,
        pushCommentsEnabled: data?.push_comments_enabled !== false,
        pushFacilityUpdatesEnabled: data?.push_facility_updates_enabled !== false,
        pushIssueUpdatesEnabled: data?.push_issue_updates_enabled !== false,
        userOpenedAt: data?.user_opened_at ?? null,
      },
      topic: `notification-state:${item.aggregate_id}`,
    }];
  }

  const eventType = contentEventType(item.event_type);
  if (!eventType) return [];
  const payload = asRecord(item.payload);
  const targetId = item.event_type.includes("comment_")
    ? asString(payload.comment_id, item.aggregate_id)
    : item.aggregate_id;
  const domain = item.aggregate_type === "issue"
    ? "issues"
    : item.aggregate_type === "facility"
    ? "facilities"
    : "announcements";
  const { data: versionRow, error: versionError } = await database.table("app_private", "content_versions")
    .select("version").eq("domain", domain).maybeSingle();
  if (versionError) throw versionError;
  const realtimePayload: Record<string, unknown> = {
    aggregateRevision: item.aggregate_version,
    category: asString(payload.category || payload.issue_category || payload.category_id) || null,
    commentCount: typeof payload.comment_count === "number" ? payload.comment_count : null,
    createdAt: item.occurred_at,
    domainRevision: Number(versionRow?.version ?? 0),
    eventId: item.event_id,
    eventType,
    likeCount: typeof payload.like_count === "number" ? payload.like_count : null,
    op: item.event_type.endsWith(".created") || item.event_type.endsWith("comment_created")
      ? "insert"
      : item.event_type.endsWith(".deleted") || item.event_type.endsWith("comment_deleted")
      ? "delete"
      : "update",
    operationId: item.operation_id,
    parentId: item.event_type.includes("comment_") ? item.aggregate_id : null,
    supportCount: typeof payload.support_count === "number" ? payload.support_count : null,
    targetId,
  };

  let topics = ["content:school"];
  if (item.aggregate_type === "issue") {
    let readAccess = asString(payload.read_access);
    let authorUid = asString(payload.author_uid);
    let status = asString(payload.new_status);
    if ((!readAccess || !authorUid || !status) && item.event_type !== "issue.deleted") {
      const { data, error } = await database.table("app_private", "issues")
        .select("author_uid,read_access,status")
        .eq("id", item.aggregate_id)
        .maybeSingle();
      if (error) throw error;
      readAccess ||= asString(data?.read_access);
      authorUid ||= asString(data?.author_uid);
      status ||= asString(data?.status);
    }
    const privateIssue = readAccess === "owner-admin"
      || (readAccess === "reviewed-school" && (status === "under-review" || status === "review-rejected"));
    if (privateIssue) topics = ["content:admin", ...(authorUid ? [`content:user:${authorUid}`] : [])];
  }

  return topics.map((topic) => ({
    event: "content_changed",
    id: item.event_id,
    payload: realtimePayload,
    topic,
  }));
}

export async function processRealtimeDeliveries(database: AppDatabaseClient, env: Env) {
  const log = createFunctionLogger("processRealtimeDeliveries");
  const { data, error } = await database.call("app_api", "claim_event_deliveries", {
    target_destination: "realtime",
    batch_size: 50,
  });
  if (error) throw error;
  const items = (data ?? []) as EventDeliveryItem[];
  if (items.length === 0) return { hasMore: false, processedCount: 0 };

  const deliveries = await Promise.all(items.map((item) => realtimeDeliveriesForItem(database, item)))
    .then((groups) => groups.flat());
  const attemptIds = new Map(items.map((item) => [item.delivery_id, crypto.randomUUID()]));

  try {
    await env.REALTIME.getByName("global").publish(deliveries);
    for (const item of items) {
      await database.call("app_api", "complete_event_delivery", {
        delivery_id: item.delivery_id,
        attempt_id: attemptIds.get(item.delivery_id)!,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    for (const item of items) {
      const attemptId = attemptIds.get(item.delivery_id)!;
      log.error("realtime-delivery.failed", err, {
        attemptId,
        deliveryId: item.delivery_id,
        eventId: item.event_id,
        eventType: item.event_type,
      });
      await database.call("app_api", "fail_event_delivery", {
        delivery_id: item.delivery_id,
        attempt_id: attemptId,
        error_info: { message },
      });
    }
  }

  return { hasMore: items.length === 50, processedCount: items.length };
}
