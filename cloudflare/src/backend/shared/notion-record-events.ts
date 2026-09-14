import {
  appendTimelineBlockWithDeduplication,
  callNotionAPI,
  dateProperty,
  ensureDateProperty,
  ensureNumberProperty,
  ensureSelectOption,
  numberProperty,
} from "./notion-api.ts";
import {
  appendCreationTimeline,
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

async function appendAnnouncementComment(
  database: NotionEventDatabase,
  pageId: string,
  marker: string,
  authorUid: string,
  content: string,
) {
  await appendTimelineBlockWithDeduplication(
    pageId,
    marker,
    `【公告留言】${await resolveDisplayName(database, authorUid)}`,
    content,
  );
}

export async function rebuildAnnouncementNotionPage(database: NotionEventDatabase, announcementId: string) {
  const announcement = await readAnnouncement(database, announcementId);
  if (!announcement) throw new Error("notion-announcement-source-missing");
  const pageId = await ensureAnnouncementPage(database, announcement);
  await appendCreationTimeline(
    database,
    pageId,
    `rebuild:announcement:${announcement.id}`,
    `【公告內容】${announcement.title}`,
    announcement.content,
  );
  const { rows: comments } = await database.sql<Selected<
    "announcement_comments",
    "id" | "author_uid" | "content" | "created_at"
  >>`select id, author_uid, content, created_at from app_private.announcement_comments
    where announcement_id = ${announcement.id} order by created_at, id`;
  for (const comment of comments) {
    await appendAnnouncementComment(
      database,
      pageId,
      `rebuild:announcement-comment:${comment.id}`,
      comment.author_uid,
      comment.content,
    );
  }
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
    await appendTimelineBlockWithDeduplication(pageId, event_id, "【公告刪除】此公告已自 Novae 刪除");
    return;
  }

  const announcement = await readAnnouncement(database, aggregate_id);
  if (!announcement) throw new Error("notion-announcement-source-missing");
  const pageId = await ensureAnnouncementPage(database, announcement);
  switch (event_type) {
    case "announcement.created":
    case "announcement.updated":
      await appendCreationTimeline(database, pageId, event_id, `【公告發布】${announcement.title}`, announcement.content);
      return;
    case "announcement.liked":
      return;
    case "announcement.comment_created":
      await appendAnnouncementComment(database, pageId, event_id, actor_uid, String(payload.content ?? ""));
      return;
    case "announcement.comment_deleted":
      await appendTimelineBlockWithDeduplication(pageId, event_id, "【公告留言刪除】一則留言已自 Novae 刪除");
      return;
    default:
      throw new Error(`unsupported-notion-record-event:${event_type}`);
  }
}
