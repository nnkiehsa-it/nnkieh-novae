import type { Json } from "../database/schema.ts";
import type { JsonRecord } from "../actions/types.ts";
import { announcementEvents } from "./announcement-events.ts";
import { facilityEvents } from "./facility-events.ts";
import { issueEvents } from "./issue-events.ts";
import { platformEvents } from "./platform-events.ts";

export type EventDestination = "notion" | "in_app" | "push" | "realtime";

export const DOMAIN_EVENT_TYPES = [
  "issue.created", "issue.status_changed", "issue.result_updated", "issue.deleted",
  "support.goal_met", "support.toggled", "issue.comment_created", "issue.comment_deleted",
  "facility.created", "facility.status_changed", "facility.deleted", "facility.affected_toggled",
  "announcement.created", "announcement.updated", "announcement.deleted", "announcement.liked",
  "announcement.comment_created", "announcement.comment_deleted", "admin.audit_recorded",
  "category.managed", "category.updated", "platform.settings_updated", "system.setup_completed",
  "system.features_updated", "user.restricted", "user.role_changed", "user.access_scoped",
  "user.avatar_updated", "notification.marked_opened", "push_token.updated", "upload.mutated",
  // Recorded by the retired media-deletion console. Nothing announces it now,
  // and the events that carry it still point at this registry.
  "deletion_job.retried",
] as const;

export type DomainEventType = typeof DOMAIN_EVENT_TYPES[number];

export interface ResolvedDomainEvent {
  aggregateType: string;
  aggregateId: string;
  eventType: DomainEventType;
  destinations: EventDestination[];
  payload: Json;
}

/**
 * A finished write, as the domains read it.
 *
 * An action answers with the thing it wrote, so the events it announces are
 * drawn from the response first and the request only where the response is
 * silent.
 */
export interface WriteOutcome {
  action: string;
  payload: JsonRecord;
  actorUid: string;
  res: JsonRecord;
  resIssue: JsonRecord;
  resFacility: JsonRecord;
  resAnnouncement: JsonRecord;
  resComment: JsonRecord;
}

/**
 * What one write announces.
 *
 * Each domain answers for its own actions and returns null for the rest, so an
 * action nobody claims is a write that was registered without saying what it
 * announces — which fails here rather than going out silently.
 */
export function resolveDomainEvents(
  action: string,
  payload: JsonRecord,
  result: unknown,
  actorUid: string,
): ResolvedDomainEvent[] {
  const res = (result ?? {}) as JsonRecord;
  const outcome: WriteOutcome = {
    action,
    payload,
    actorUid,
    res,
    resIssue: (res.issue ?? {}) as JsonRecord,
    resFacility: (res.facility ?? {}) as JsonRecord,
    resAnnouncement: (res.announcement ?? {}) as JsonRecord,
    resComment: (res.comment ?? {}) as JsonRecord,
  };

  for (const resolve of [issueEvents, facilityEvents, announcementEvents, platformEvents]) {
    const events = resolve(outcome);
    if (events) return events;
  }
  throw new Error(`unregistered-write-action:${action}`);
}
