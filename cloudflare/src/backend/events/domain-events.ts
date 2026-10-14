import type { ActionInput, WriteActionName } from "../../../../shared/actions.ts";
import type { Json } from "../database/schema.ts";
import type { ActionResult } from "../actions/registry.ts";
import { ANNOUNCEMENT_ANNOUNCERS } from "./announcement-events.ts";
import { FACILITY_ANNOUNCERS } from "./facility-events.ts";
import { ISSUE_ANNOUNCERS } from "./issue-events.ts";
import { PLATFORM_ANNOUNCERS } from "./platform-events.ts";

export type EventDestination = "notion" | "in_app" | "push" | "realtime";

export const DOMAIN_EVENT_TYPES = [
  "issue.created", "issue.status_changed", "issue.result_updated", "issue.deleted",
  "support.goal_met", "support.toggled", "issue.comment_created", "issue.comment_deleted",
  "facility.created", "facility.status_changed", "facility.deleted", "facility.affected_toggled",
  "announcement.created", "announcement.updated", "announcement.deleted", "announcement.liked",
  "announcement.comment_created", "announcement.comment_deleted", "admin.audit_recorded",
  "category.managed", "category.updated", "platform.settings_updated", "system.setup_completed",
  "user.restricted", "user.role_changed", "user.access_scoped",
  "user.avatar_updated", "notification.marked_opened", "push_token.updated", "upload.mutated",
  // Recorded by retired writes: the media-deletion console and the separate
  // feature-switch save. Nothing announces them now, and the events that
  // carry them still point at this registry.
  "deletion_job.retried", "system.features_updated",
] as const;

export type DomainEventType = typeof DOMAIN_EVENT_TYPES[number];

export interface ResolvedDomainEvent {
  aggregateType: string;
  aggregateId: string;
  eventType: DomainEventType;
  destinations: EventDestination[];
  payload: Json;
}

/** A finished write: what was asked, by whom, and what the handler finished with. */
export interface FinishedWrite<N extends WriteActionName> {
  input: ActionInput<N>;
  result: ActionResult<N>;
  actorUid: string;
}

/** What each write announces; a write may announce nothing, but never goes unsaid. */
export type Announcers = { [N in WriteActionName]: (write: FinishedWrite<N>) => ResolvedDomainEvent[] };

const ANNOUNCERS: Announcers = {
  ...ISSUE_ANNOUNCERS,
  ...FACILITY_ANNOUNCERS,
  ...ANNOUNCEMENT_ANNOUNCERS,
  ...PLATFORM_ANNOUNCERS,
};

export function resolveDomainEvents<N extends WriteActionName>(name: N, write: FinishedWrite<N>): ResolvedDomainEvent[] {
  const announce = ANNOUNCERS[name] as (write: FinishedWrite<N>) => ResolvedDomainEvent[];
  return announce(write);
}
