import type { AppDatabaseClient } from "../database/client.ts";

/** One claimed delivery: an event, and how many times it has been tried. */
export interface EventDeliveryItem {
  delivery_id: string;
  event_id: string;
  operation_id: string;
  destination: string;
  attempt_count: number;
  last_attempt_id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  actor_uid: string;
  occurred_at: string;
  payload: Record<string, unknown>;
  aggregate_version: number;
}
export async function settleDelivery(database: AppDatabaseClient, state: 'complete' | 'fail',
  args: { delivery_id: string; attempt_id: string; error_info?: { message: string } }) {
  if (state === 'complete') {
    await database.sql`select app_api.complete_event_delivery(${args.delivery_id}, ${args.attempt_id})`;
  } else {
    await database.sql`select app_api.fail_event_delivery(
      ${args.delivery_id}, ${args.attempt_id}, ${JSON.stringify(args.error_info)}::jsonb)`;
  }
}
