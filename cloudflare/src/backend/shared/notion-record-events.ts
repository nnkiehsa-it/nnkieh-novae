import {
  callNotionAPI,
  dateProperty,
  ensureDateProperty,
  ensureNumberProperty,
  ensureSelectOption,
  numberProperty,
} from "./notion-api.ts";
import { writeNotionTimeline, type NotionTimelineEntry } from "./notion-timeline.ts";
import {
  contentTimelineEntry,
  getMappedNotionPage,
  getOrCreateNotionPage,
  resolveDisplayName,
} from "./notion-page.ts";
import { rebuildAuditNotionPage } from "./notion-audit-events.ts";
import type { NotionDomainEvent, NotionEventDatabase } from "./notion-event.ts";
import type { Selected } from "../database/schema.ts";

type AnnouncementNotionRecord = Selected<
  "announcements",
  "id" | "title" | "content" | "author_uid" | "published_at" | "like_count" | "comment_count"
>;

async function readAnnouncement(database: NotionEventDatabase, announcementId: string) {
  return database.sqlMaybe<AnnouncementNotionRecord>`select id, title, content, author_uid, published_at,
    like_count, comment_count from app_private.announcements where id = ${announcementId}`;
}

async function ensureAnnouncementPage(database: NotionEventDatabase, announcement: AnnouncementNotionRecord) {
  const pageId = await getOrCreateNotionPage(
    database,
    "announcement",
    announcement.id,
    announcement.title,
    "公告",
    "已發布",
    await resolveDisplayName(database, announcement.author_uid),
    undefined,
    undefined,
    null,
  );
  if (!pageId) throw new Error("notion-announcement-page-missing");
  await Promise.all([
    ensureDateProperty("發布時間"),
    ensureNumberProperty("按讚數"),
    ensureNumberProperty("留言數"),
  ]);
  await callNotionAPI(`/pages/${pageId}`, "PATCH", {
    properties: {
      發布時間: dateProperty(announcement.published_at),
      按讚數: numberProperty(announcement.like_count),
      留言數: numberProperty(announcement.comment_count),
    },
  });
  return pageId;
}

async function commentEntry(
  database: NotionEventDatabase,
  eventId: string,
  authorUid: string,
  content: string,
): Promise<NotionTimelineEntry> {
  return {
    details: content,
    eventId,
    summary: `【公告留言】${await resolveDisplayName(database, authorUid)}`,
  };
}

export async function rebuildAnnouncementNotionPage(database: NotionEventDatabase, announcementId: string) {
  const announcement = await readAnnouncement(database, announcementId);
  if (!announcement) throw new Error("notion-announcement-source-missing");
  const pageId = await ensureAnnouncementPage(database, announcement);
  const { rows: comments } = await database.sql<Selected<
    "announcement_comments",
    "id" | "author_uid" | "content" | "created_at"
  >>`select id, author_uid, content, created_at from app_private.announcement_comments
    where announcement_id = ${announcement.id} order by created_at, id`;
  await writeNotionTimeline(pageId, [
    contentTimelineEntry(
      database,
      `rebuild:announcement:${announcement.id}`,
      `【公告內容】${announcement.title}`,
      announcement.content,
    ),
    ...await Promise.all(comments.map((comment) => commentEntry(
      database,
      `rebuild:announcement-comment:${comment.id}`,
      comment.author_uid,
      comment.content,
    ))),
  ]);
  return pageId;
}

/** Announcements and one human-readable record for every administrator operation. */
export async function syncRecordEventToNotion(
  database: NotionEventDatabase,
  event: NotionDomainEvent,
): Promise<void> {
  const { event_id, event_type, aggregate_id, actor_uid, payload } = event;
  if (event_type === "admin.audit_recorded") {
    await rebuildAuditNotionPage(database, aggregate_id);
    return;
  }
  if (event_type === "announcement.deleted") {
    const pageId = await getMappedNotionPage(database, "announcement", aggregate_id);
    if (!pageId) return;
    await ensureSelectOption("狀態", "已刪除");
    await callNotionAPI(`/pages/${pageId}`, "PATCH", {
      properties: { 狀態: { select: { name: "已刪除" } } },
    });
    await writeNotionTimeline(pageId, [
      { eventId: event_id, summary: "【公告刪除】此公告已自 Novae 刪除" },
    ]);
    return;
  }

  const announcement = await readAnnouncement(database, aggregate_id);
  if (!announcement) throw new Error("notion-announcement-source-missing");
  const pageId = await ensureAnnouncementPage(database, announcement);
  switch (event_type) {
    case "announcement.created":
    case "announcement.updated":
      await writeNotionTimeline(pageId, [contentTimelineEntry(
        database, event_id, `【公告發布】${announcement.title}`, announcement.content,
      )]);
      return;
    case "announcement.liked":
      return;
    case "announcement.comment_created":
      await writeNotionTimeline(pageId, [
        await commentEntry(database, event_id, actor_uid, String(payload.content ?? "")),
      ]);
      return;
    case "announcement.comment_deleted":
      await writeNotionTimeline(pageId, [
        { eventId: event_id, summary: "【公告留言刪除】一則留言已自 Novae 刪除" },
      ]);
      return;
    default:
      throw new Error(`unsupported-notion-record-event:${event_type}`);
  }
}
