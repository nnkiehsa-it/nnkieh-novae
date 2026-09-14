import type { AppDatabaseClient } from "../database/client.ts";

/** A recorded domain event, as the delivery hands it over. */
export interface NotionDomainEvent {
  event_id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  actor_uid: string;
  occurred_at: string;
  payload: Record<string, unknown>;
}

export type NotionEventDatabase = AppDatabaseClient;
