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
} from "./notion-page.ts";
import type { NotionDomainEvent, NotionEventDatabase } from "./notion-event.ts";
import type { Selected } from "../database/schema.ts";
import { syncSystemEventToNotion } from "./notion-system-events.ts";

/** Announcements, the administration audit, and anything else worth recording. */
export async function syncRecordEventToNotion(
  database: NotionEventDatabase,
  event: NotionDomainEvent,
): Promise<void> {
  const { event_id, event_type, aggregate_type, aggregate_id, actor_uid, payload } = event;
  switch (event_type) {
    case "announcement.created": {
      const announcement = await database.sqlMaybe<
        Selected<"announcements", "title" | "content" | "author_uid" | "published_at">
      >`select title, content, author_uid, published_at
        from app_private.announcements where id = ${aggregate_id}`;
      const title = String(announcement?.title ?? payload.title ?? "未命名公告");
      const authorName = await resolveDisplayName(database, announcement?.author_uid ?? actor_uid);
      const pageId = await getOrCreateNotionPage(
        database,
        "announcement",
        aggregate_id,
        title,
        "公告",
        "發布",
        authorName,
      );
      if (!pageId) return;

      await appendCreationTimeline(
        database,
        pageId,
        event_id,
        `【公告發布】${title}`,
        String(announcement?.content ?? payload.content ?? ""),
      );
      break;
    }

    case "announcement.deleted": {
      const pageId = await getOrCreateNotionPage(
        database, "announcement", aggregate_id, "公告", "公告", "已刪除", "使用者",
      );
      if (!pageId) return;
      await ensureSelectOption("狀態", "已刪除");
      await callNotionAPI(`/pages/${pageId}`, "PATCH", {
        properties: { 狀態: { select: { name: "已刪除" } } },
      });
      await appendTimelineBlockWithDeduplication(
        pageId,
        event_id,
        "【公告刪除】此公告已自 Novae 刪除",
      );
      break;
    }

    case "announcement.comment_created": {
      const pageId = await getOrCreateNotionPage(
        database, "announcement", aggregate_id, "公告", "公告", "發布", "使用者",
      );
      if (!pageId) return;
      const author = await resolveDisplayName(database, actor_uid);
      const content = String(payload.content ?? "");
      await appendTimelineBlockWithDeduplication(
        pageId,
        event_id,
        `【公告留言】${author}`,
        content,
      );
      break;
    }

    case "admin.audit_recorded": {
      const action = String(payload.action ?? "管理操作");
      const actorName = await resolveDisplayName(database, actor_uid);
      const pageId = await getOrCreateNotionPage(
        database,
        "admin-audit",
        aggregate_id,
        `【管理稽核】${action}`,
        "管理操作",
        "已記錄",
        actorName,
        undefined,
        undefined,
        null,
      );
      if (!pageId) return;

      await Promise.all([
        ensureDateProperty("操作時間"),
        ensureRichTextProperty("操作類型"),
        ensureRichTextProperty("操作領域"),
        ensureRichTextProperty("目標 ID"),
        ensureRichTextProperty("詳細資料"),
      ]);

      const detail = (payload.detail ?? {}) as Record<string, unknown>;
      await callNotionAPI(`/pages/${pageId}`, "PATCH", {
        properties: {
          操作時間: dateProperty(event.occurred_at),
          操作類型: richTextProperty(action),
          操作領域: richTextProperty(payload.domain),
          "目標 ID": richTextProperty(payload.target_id),
          詳細資料: richTextProperty(JSON.stringify(detail)),
        },
      });

      await appendTimelineBlockWithDeduplication(
        pageId,
        event_id,
        `【管理稽核】${action} 由 ${actorName}`,
        JSON.stringify(detail, null, 2),
      );
      break;
    }

    default:
      await syncSystemEventToNotion(database, event);
      break;
  }
}
