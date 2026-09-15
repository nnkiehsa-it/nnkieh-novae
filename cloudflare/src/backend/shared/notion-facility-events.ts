import {
  callNotionAPI,
  dateProperty,
  ensureDateProperty,
  ensureNumberProperty,
  ensureRichTextProperty,
  ensureSelectOption,
  numberProperty,
  richTextProperty,
} from "./notion-api.ts";
import { writeNotionTimeline } from "./notion-timeline.ts";
import {
  contentTimelineEntry,
  getMappedNotionPage,
  getOrCreateNotionPage,
  resolveDisplayName,
  translateFacilityStatus,
} from "./notion-page.ts";
import type { NotionDomainEvent, NotionEventDatabase } from "./notion-event.ts";
import type { Selected } from "../database/schema.ts";

type FacilityNotionRecord = Selected<
  "facility_reports",
  "id" | "title" | "content" | "location" | "status" | "author_uid" | "affected_count"
  | "category_id" | "created_at" | "started_at" | "closed_at" | "result_content"
>;

async function readFacility(database: NotionEventDatabase, facilityId: string) {
  return database.sqlMaybe<FacilityNotionRecord>`select id, title, content, location, status, author_uid,
    affected_count, category_id, created_at, started_at, closed_at, result_content
    from app_private.facility_reports where id = ${facilityId}`;
}

async function ensureFacilityPage(database: NotionEventDatabase, facility: FacilityNotionRecord) {
  const status = translateFacilityStatus(facility.status);
  const pageId = await getOrCreateNotionPage(
    database,
    "facility",
    facility.id,
    facility.title,
    facility.category_id,
    status,
    await resolveDisplayName(database, facility.author_uid),
    facility.affected_count,
    null,
    "遇到人數",
  );
  if (!pageId) throw new Error("notion-facility-page-missing");
  await Promise.all([
    ensureDateProperty("建立時間"),
    ensureDateProperty("開始處理時間"),
    ensureDateProperty("結案時間"),
    ensureNumberProperty("受影響人數"),
    ensureRichTextProperty("地點"),
    ensureRichTextProperty("處理結果"),
    ensureSelectOption("狀態", status),
  ]);
  await callNotionAPI(`/pages/${pageId}`, "PATCH", {
    properties: {
      狀態: { select: { name: status } },
      建立時間: dateProperty(facility.created_at),
      開始處理時間: dateProperty(facility.started_at),
      結案時間: dateProperty(facility.closed_at),
      地點: richTextProperty(facility.location),
      處理結果: richTextProperty(facility.result_content),
      遇到人數: richTextProperty(facility.affected_count),
      受影響人數: numberProperty(facility.affected_count),
    },
  });
  return pageId;
}

export async function rebuildFacilityNotionPage(database: NotionEventDatabase, facilityId: string) {
  const facility = await readFacility(database, facilityId);
  if (!facility) throw new Error("notion-facility-source-missing");
  const pageId = await ensureFacilityPage(database, facility);
  await writeNotionTimeline(pageId, [contentTimelineEntry(
    database,
    `rebuild:facility:${facility.id}`,
    `【設備案件內容】${facility.title}（地點：${facility.location}）`,
    facility.content,
  )]);
  return pageId;
}

/** Keeps a facility page's status, counts, dates and result complete. */
export async function syncFacilityEventToNotion(
  database: NotionEventDatabase,
  event: NotionDomainEvent,
): Promise<void> {
  const { event_id, event_type, aggregate_id } = event;
  if (event_type === "facility.deleted") {
    const pageId = await getMappedNotionPage(database, "facility", aggregate_id);
    if (!pageId) return;
    await ensureSelectOption("狀態", "已刪除");
    await callNotionAPI(`/pages/${pageId}`, "PATCH", {
      properties: { 狀態: { select: { name: "已刪除" } } },
    });
    await writeNotionTimeline(pageId, [
      { eventId: event_id, summary: "【設備案件刪除】此案件已自 Novae 刪除" },
    ]);
    return;
  }

  const facility = await readFacility(database, aggregate_id);
  if (!facility) throw new Error("notion-facility-source-missing");
  const pageId = await ensureFacilityPage(database, facility);
  switch (event_type) {
    case "facility.created":
      await writeNotionTimeline(pageId, [contentTimelineEntry(
        database,
        event_id,
        `【設備案件建立】${facility.title}（地點：${facility.location}）`,
        facility.content,
      )]);
      return;
    case "facility.status_changed":
      await writeNotionTimeline(pageId, [{
        details: facility.result_content ? `處理結果：${facility.result_content}` : undefined,
        eventId: event_id,
        summary: `【狀態變更】${translateFacilityStatus(facility.status)}`,
      }]);
      return;
    case "facility.affected_toggled":
      return;
    default:
      throw new Error(`unsupported-notion-facility-event:${event_type}`);
  }
}
