import type { AppDatabaseClient } from "../database/client.ts";
import { syncDomainEventToNotion } from "../shared/notion-sync.ts";
import { createFunctionLogger } from "../shared/observability.ts";
import { operationPolicy } from '../shared/operation-policies.ts';
import { settleDelivery, type EventDeliveryItem } from "./delivery-attempt.ts";

/** Carrying events into the Notion archive, one claimed batch at a time. */
export async function processNotionDeliveries(database: AppDatabaseClient) {
  const batchSize = operationPolicy('notionBatchSize');
  const log = createFunctionLogger("processNotionDeliveries");
  const { data, error } = await database.call("app_api", "claim_event_deliveries", {
    target_destination: "notion",
    batch_size: batchSize,
  });
  if (error) throw error;
  const items = (data ?? []) as EventDeliveryItem[];

  for (const item of items) {
    const attemptId = item.last_attempt_id;
    try {
      if (!['issue','facility','announcement'].includes(item.aggregate_type)
        && Date.parse(item.occurred_at) < Date.now() - operationPolicy('notionArchiveDays') * 86400000) {
        await settleDelivery(database,'complete',{ delivery_id:item.delivery_id,attempt_id:attemptId });
        continue;
      }
      await syncDomainEventToNotion(database, {
        event_id: item.event_id,
        event_type: item.event_type,
        aggregate_type: item.aggregate_type,
        aggregate_id: item.aggregate_id,
        actor_uid: item.actor_uid,
        occurred_at: item.occurred_at,
        payload: item.payload,
      });
      await settleDelivery(database, 'complete', {
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
      await settleDelivery(database, 'fail', {
        delivery_id: item.delivery_id,
        attempt_id: attemptId,
        error_info: { message },
      });
    }
  }

  return { hasMore: items.length === batchSize, processedCount: items.length };
}
