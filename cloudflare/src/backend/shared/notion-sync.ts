import { notionEnabled } from "./notion-api.ts";
import { syncFacilityEventToNotion } from "./notion-facility-events.ts";
import { syncIssueEventToNotion } from "./notion-issue-events.ts";
import { syncRecordEventToNotion } from "./notion-record-events.ts";
import type { NotionDomainEvent, NotionEventDatabase } from "./notion-event.ts";

/**
 * Which part of the archive an event belongs to.
 *
 * The whole archive used to be one switch of four hundred lines, so a change to
 * how a facility report is written meant reading past every proposal and every
 * audit entry. An event goes to the one kind of record it is about.
 */
export async function syncDomainEventToNotion(
  database: NotionEventDatabase,
  event: NotionDomainEvent,
): Promise<void> {
  if (!notionEnabled()) return;
  if (event.event_type.startsWith("issue.") || event.event_type.startsWith("support.")) {
    await syncIssueEventToNotion(database, event);
    return;
  }
  if (event.event_type.startsWith("facility.")) {
    await syncFacilityEventToNotion(database, event);
    return;
  }
  await syncRecordEventToNotion(database, event);
}
