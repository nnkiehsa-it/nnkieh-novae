import type { Env } from "../../types";
import type { AppDatabaseClient } from "../database/client.ts";
import { asRecord, asString } from "../shared/http.ts";
import { createFunctionLogger } from "../shared/observability.ts";
import { operationPolicy } from '../shared/operation-policies.ts';
import type { RealtimeDelivery } from "../../durable/realtime-hub.ts";
import { checked, settleDelivery, type EventDeliveryItem } from "./delivery-attempt.ts";
import { notificationRealtimePayload } from "./notification-content.ts";

/** Telling the open sockets what changed, so a reader does not have to ask. */
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
  const batchSize = operationPolicy('realtimeBatchSize');
  const log = createFunctionLogger("processRealtimeDeliveries");
  const { data, error } = await database.call("app_api", "claim_event_deliveries", {
    target_destination: "realtime",
    batch_size: batchSize,
  });
  if (error) throw error;
  const items = (data ?? []) as EventDeliveryItem[];
  if (items.length === 0) return { hasMore: false, processedCount: 0 };

  const deliveries = await Promise.all(items.map((item) => realtimeDeliveriesForItem(database, item)))
    .then((groups) => groups.flat());
  const attemptIds = new Map(items.map((item) => [item.delivery_id, item.last_attempt_id]));

  try {
    await env.REALTIME.getByName("global").publish(deliveries);
    for (const item of items) {
      await settleDelivery(database, 'complete', {
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
      await settleDelivery(database, 'fail', {
        delivery_id: item.delivery_id,
        attempt_id: attemptId,
        error_info: { message },
      });
    }
  }

  return { hasMore: items.length === batchSize, processedCount: items.length };
}
