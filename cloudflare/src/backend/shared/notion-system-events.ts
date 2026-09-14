import { appendTimelineBlockWithDeduplication } from "./notion-api.ts";
import { getOrCreateNotionPage, resolveDisplayName } from "./notion-page.ts";
import type { NotionDomainEvent, NotionEventDatabase } from "./notion-event.ts";

/**
 * An event with no archive of its own.
 *
 * Category and system management events still belong in the record, so each one
 * gets a page named after itself rather than being dropped for not being a
 * proposal.
 */
export async function syncSystemEventToNotion(
  database: NotionEventDatabase,
  event: NotionDomainEvent,
): Promise<void> {
  const { event_id, event_type, aggregate_type, aggregate_id, actor_uid, payload } = event;
  const pageId = await getOrCreateNotionPage(
    database,
    aggregate_type,
    aggregate_id,
    `系統事件: ${event_type}`,
    "系統維運",
    "已處理",
    await resolveDisplayName(database, actor_uid),
  );
  if (pageId) {
    await appendTimelineBlockWithDeduplication(
      pageId,
      event_id,
      `【系統事件】${event_type}`,
      JSON.stringify(payload),
    );
  }
}
