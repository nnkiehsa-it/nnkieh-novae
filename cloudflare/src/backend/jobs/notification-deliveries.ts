import type { Env } from "../../types";
import type { AppDatabaseClient } from "../database/client.ts";
import { isInvalidFcmTokenError, sendFcmMessage } from "../shared/fcm.ts";
import { asRecord, asString } from "../shared/http.ts";
import { createFunctionLogger } from "../shared/observability.ts";
import { operationPolicy } from '../shared/operation-policies.ts';
import type { RealtimeDelivery } from "../../durable/realtime-hub.ts";
import { checked, settleDelivery, type EventDeliveryItem } from "./delivery-attempt.ts";
import { resolveRecipients } from "./delivery-recipients.ts";
import {
  deterministicNotificationId,
  isCommentNotificationType,
  isIssueUpdateNotificationType,
  notificationRealtimePayload,
  resolveNotificationPayload,
} from "./notification-content.ts";

/** Writing a notification down, and pushing it to the devices that want it. */
export async function processInAppDeliveries(database: AppDatabaseClient, env: Env) {
  const batchSize = operationPolicy('notificationBatchSize');
  const log = createFunctionLogger("processInAppDeliveries");
  const { data, error } = await database.call("app_api", "claim_event_deliveries", {
    target_destination: "in_app",
    batch_size: batchSize,
  });
  if (error) throw error;
  const items = (data ?? []) as EventDeliveryItem[];

  for (const item of items) {
    const attemptId = item.last_attempt_id;
    try {
      const base = resolveNotificationPayload(item);
      const realtimeNotifications: RealtimeDelivery[] = [];
      if (base) {
        if (base.source === "broadcast") {
          const id = await deterministicNotificationId(item.event_id, "broadcast");
          const notification = { ...base, recipient_uid: null, origin: "live" as const, created_at: item.occurred_at, id };
          await checked(database.table("app_private", "notifications").upsert([notification], {
            ignoreDuplicates: true,
            onConflict: "id",
          }));
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
            await checked(database.table("app_private", "notifications").upsert(notifications, {
              ignoreDuplicates: true,
              onConflict: "id",
            }));
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
      await settleDelivery(database, 'complete', {
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
      await settleDelivery(database, 'fail', {
        delivery_id: item.delivery_id,
        attempt_id: attemptId,
        error_info: { message },
      });
    }
  }

  return { hasMore: items.length === batchSize, processedCount: items.length };
}
export async function processPushDeliveries(database: AppDatabaseClient) {
  const batchSize = operationPolicy('notificationBatchSize');
  const log = createFunctionLogger("processPushDeliveries");
  const { data, error } = await database.call("app_api", "claim_event_deliveries", {
    target_destination: "push",
    batch_size: batchSize,
  });
  if (error) throw error;
  const items = (data ?? []) as EventDeliveryItem[];

  for (const item of items) {
    const attemptId = item.last_attempt_id;
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
            const { data: prefRows } = await checked(prefQuery);
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
            const { data: tokenRows } = await checked(query);
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
              await checked(database.table("app_private", "push_tokens").delete().eq("token", tokenRow.token));
            } else {
              throw err;
            }
          }
        }
      }

      await settleDelivery(database, 'complete', {
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
      await settleDelivery(database, 'fail', {
        delivery_id: item.delivery_id,
        attempt_id: attemptId,
        error_info: { message },
      });
    }
  }

  return { hasMore: items.length === batchSize, processedCount: items.length };
}
