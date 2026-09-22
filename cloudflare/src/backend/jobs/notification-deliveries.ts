import type { Env } from "../../types";
import type { AppDatabaseClient } from "../database/client.ts";
import { isInvalidFcmTokenError, sendFcmMessage } from "../shared/fcm.ts";
import { asRecord, asString } from "../shared/http.ts";
import { createFunctionLogger } from "../shared/observability.ts";
import { operationPolicy } from '../shared/operation-policies.ts';
import type { RealtimeDelivery } from "../../durable/realtime-hub.ts";
import type { Selected } from "../database/schema.ts";
import { settleDelivery, type EventDeliveryItem } from "./delivery-attempt.ts";
import { resolveRecipients } from "./delivery-recipients.ts";
import {
  deterministicNotificationId,
  isCommentNotificationType,
  notificationRealtimePayload,
  resolveNotificationPayload,
} from "./notification-content.ts";

/**
 * Writes a batch of notifications, ignoring any this event already produced.
 *
 * The rows are heterogeneous — a comment carries a comment id, a status change
 * carries the statuses it moved between — so they arrive as JSON and take their
 * column types from the table itself. Columns no row mentions are left to their
 * defaults by naming the ones that are written.
 */
async function storeNotifications(database: AppDatabaseClient, notifications: Record<string, unknown>[]) {
  await database.sql`
    insert into app_private.notifications (
      id, source, recipient_uid, type, target_type, target_id, comment_id, title,
      actor_uid, body_preview, issue_category, old_status, new_status, created_at, origin)
    select id, source, recipient_uid, type, target_type, target_id, comment_id, title,
      actor_uid, body_preview, issue_category, old_status, new_status, created_at, origin
    from jsonb_populate_recordset(null::app_private.notifications, ${JSON.stringify(notifications)}::jsonb)
    on conflict (id) do nothing`;
}

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
          await storeNotifications(database, [notification]);
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
            await storeNotifications(database, notifications);
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

        const tokens: Array<{ token: string; uid: string }> = [];
        const seenTokens = new Set<string>();
        if (recipients.length > 0 || broadcast) {
          const everyDevice = recipients.length === 0;
          for (let offset = 0; ; offset += 200) {
            const { rows: tokenRows } = await database.sql<Selected<"push_tokens", "uid" | "token">>`
              select uid, token from app_private.push_tokens
              where ${everyDevice}::boolean or uid = any(${recipients})
              order by uid, device_id limit 200 offset ${offset}`;
            for (const row of tokenRows) {
              if (!row.token || seenTokens.has(row.token)) continue;
              seenTokens.add(row.token);
              tokens.push({ token: row.token, uid: row.uid });
            }
            if (tokenRows.length < 200) break;
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

        const { rows: receipts } = await database.sql<{ token_hash: string }>`
          select token_hash from app_private.push_delivery_receipts where delivery_id = ${item.delivery_id}`;
        const delivered = new Set(receipts.map((receipt) => receipt.token_hash));
        for (const tokenRow of tokens) {
          const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(tokenRow.token));
          const tokenHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
          if (delivered.has(tokenHash)) continue;
          const active = await database.sqlMaybe<{ id: string }>`select id from app_private.event_deliveries
            where id = ${item.delivery_id} and last_attempt_id = ${attemptId} and status = 'processing'`;
          if (!active) break;
          try {
            await sendFcmMessage({
              token: tokenRow.token,
              data: { ...topicData, recipient_uid: tokenRow.uid },
            });
          } catch (err) {
            if (isInvalidFcmTokenError(err)) {
              await database.sql`delete from app_private.push_tokens where token = ${tokenRow.token}`;
            } else {
              throw err;
            }
          }
          // A crash between FCM accepting and this commit can still duplicate a message;
          // ordinary retries must not resend devices whose success was persisted.
          await database.sql`insert into app_private.push_delivery_receipts (delivery_id, token_hash)
            values (${item.delivery_id}, ${tokenHash}) on conflict do nothing`;
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
