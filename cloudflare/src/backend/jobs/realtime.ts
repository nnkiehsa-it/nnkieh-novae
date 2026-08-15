import type { Env } from "../../types";
import type { AppDatabaseClient } from "../database/client.ts";
import { asRecord } from "../shared/http.ts";
import { createFunctionLogger } from "../shared/observability.ts";
import type { RealtimeDelivery } from "../../durable/realtime-hub";

interface RealtimeEventRow {
  event_name: string;
  id: string;
  payload: unknown;
  topic: string;
}

export async function processRealtimeBatch(database: AppDatabaseClient, env: Env) {
  const log = createFunctionLogger("realtimeWorker");
  const { data, error } = await database.call("app_api", "claim_realtime_events", { batch_size: 50 });
  if (error) throw error;
  const events = (data ?? []) as RealtimeEventRow[];
  if (events.length === 0) return { hasMore: false, processedCount: 0 };

  const deliveries: RealtimeDelivery[] = events.map((event) => ({
    event: event.event_name,
    id: event.id,
    payload: asRecord(event.payload),
    topic: event.topic,
  }));
  const eventIds = events.map((event) => event.id);
  try {
    await env.REALTIME.getByName("global").publish(deliveries);
    const { error: completeError } = await database.call("app_api", "complete_realtime_events", {
      event_ids: eventIds,
    });
    if (completeError) throw completeError;
  } catch (deliveryError) {
    const traceCode = crypto.randomUUID();
    log.error("realtime-delivery.failed", deliveryError, { eventCount: events.length, traceCode });
    const { error: failError } = await database.call("app_api", "fail_realtime_events", {
      event_ids: eventIds,
      trace_id: traceCode,
    });
    if (failError) throw failError;
  }
  const hasMore = events.length === 50;
  log.success("realtime-worker.completed", { hasMore, processedCount: events.length, status: 200 });
  return { hasMore, processedCount: events.length };
}
