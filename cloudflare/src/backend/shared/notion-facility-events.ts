import {
  appendTimelineBlockWithDeduplication,
  callNotionAPI,
  dateProperty,
  ensureDateProperty,
  ensureRichTextProperty,
  ensureSelectOption,
  richTextProperty,
} from "./notion-api.ts";
import {
  appendCreationTimeline,
  getOrCreateNotionPage,
  resolveDisplayName,
  translateFacilityStatus,
} from "./notion-page.ts";
import type { NotionDomainEvent, NotionEventDatabase } from "./notion-event.ts";
import { syncSystemEventToNotion } from "./notion-system-events.ts";

/** What a facility report does to its Notion page. */

export async function syncFacilityEventToNotion(
  database: NotionEventDatabase,
  event: NotionDomainEvent,
): Promise<void> {
  const { event_id, event_type, aggregate_id, actor_uid, payload } = event;
  switch (event_type) {
    case "facility.created": {
      const { data: facility } = await database
        .table("app_private", "facility_reports")
        .select("title,content,location,status,author_uid,affected_count,category_id,created_at")
        .eq("id", aggregate_id)
        .maybeSingle();
      const authorName = await resolveDisplayName(database, facility?.author_uid ?? actor_uid);
      const title = String(facility?.title ?? payload.title ?? "未命名設備報修");
      const pageId = await getOrCreateNotionPage(
        database,
        "facility",
        aggregate_id,
        title,
        String(facility?.category_id ?? payload.category_id ?? "設備"),
        translateFacilityStatus(String(facility?.status ?? "pending")),
        authorName,
        facility?.affected_count ?? 1,
        null,
        "遇到人數",
      );
      if (!pageId) return;

      await ensureRichTextProperty("地點");
      await ensureDateProperty("建立時間");
      await callNotionAPI(`/pages/${pageId}`, "PATCH", {
        properties: {
          地點: richTextProperty(facility?.location),
          建立時間: dateProperty(facility?.created_at),
        },
      });

      await appendCreationTimeline(
        database,
        pageId,
        event_id,
        `【報修建立】${title} (地點: ${String(facility?.location ?? "")})`,
        String(facility?.content ?? ""),
      );
      break;
    }

    case "facility.status_changed": {
      const { data: facility } = await database
        .table("app_private", "facility_reports")
        .select("title,category_id,status,author_uid,affected_count,closed_at,result_content")
        .eq("id", aggregate_id)
        .maybeSingle();
      const statusLabel = translateFacilityStatus(String(facility?.status ?? payload.new_status ?? "pending"));
      const pageId = await getOrCreateNotionPage(
        database,
        "facility",
        aggregate_id,
        String(facility?.title ?? "設備"),
        String(facility?.category_id ?? "設備"),
        statusLabel,
        await resolveDisplayName(database, facility?.author_uid),
        facility?.affected_count,
        null,
        "遇到人數",
      );
      if (!pageId) return;

      await ensureSelectOption("狀態", statusLabel);
      await callNotionAPI(`/pages/${pageId}`, "PATCH", {
        properties: {
          狀態: { select: { name: statusLabel } },
          結案時間: dateProperty(facility?.closed_at),
        },
      });

      await appendTimelineBlockWithDeduplication(
        pageId,
        event_id,
        `【狀態變更】${statusLabel}`,
        facility?.result_content ? `處理說明：${facility.result_content}` : undefined,
      );
      break;
    }

    case "facility.deleted": {
      const pageId = await getOrCreateNotionPage(
        database, "facility", aggregate_id, "設備", "設備", "已刪除", "使用者",
      );
      if (!pageId) return;
      await ensureSelectOption("狀態", "已刪除");
      await callNotionAPI(`/pages/${pageId}`, "PATCH", {
        properties: { 狀態: { select: { name: "已刪除" } } },
      });
      await appendTimelineBlockWithDeduplication(
        pageId,
        event_id,
        "【報修刪除】此設備報修已自 Novae 刪除",
      );
      break;
    }

    default:
      await syncSystemEventToNotion(database, event);
      break;
  }
}
