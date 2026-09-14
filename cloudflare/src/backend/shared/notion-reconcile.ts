import {
  appendTimelineBlockWithDeduplication,
  callNotionAPI,
  dateProperty,
  ensureDateProperty,
  ensureRichTextProperty,
  getDataSourceId,
  notionEnabled,
  richTextProperty,
} from "./notion-api.ts";
import {
  appendCreationTimeline,
  getOrCreateNotionPage,
  resolveDisplayName,
  translateFacilityStatus,
} from "./notion-page.ts";
import type { AppDatabaseClient } from "../database/client.ts";
import type { Selected } from "../database/schema.ts";

type AppDatabase = AppDatabaseClient;

/**
 * Rebuilding the archive from what Novae holds.
 *
 * Every page Novae manages is archived and every mapping dropped, then each
 * proposal, facility report, announcement and audit entry is written out again
 * from the database, so the archive can be restored without trusting whatever
 * state it was left in.
 */
async function archiveManagedNotionPages(): Promise<number> {
  const dataSourceId = await getDataSourceId();
  let archived = 0;
  let startCursor: string | undefined;
  do {
    const response = (await callNotionAPI(`/data_sources/${dataSourceId}/query`, "POST", {
      filter: { property: "Novae ID", rich_text: { is_not_empty: true } },
      page_size: 100,
      ...(startCursor ? { start_cursor: startCursor } : {}),
    })) as {
      has_more?: boolean;
      next_cursor?: string | null;
      results?: Array<{ id?: string }>;
    };
    for (const page of response.results ?? []) {
      if (!page.id) throw new Error("notion-managed-page-id-missing");
      await callNotionAPI(`/pages/${page.id}`, "PATCH", { in_trash: true });
      archived += 1;
    }
    startCursor = response.has_more ? response.next_cursor ?? undefined : undefined;
    if (response.has_more && !startCursor) throw new Error("notion-query-cursor-missing");
  } while (startCursor);
  return archived;
}
export async function reconcileNotionPages(database: AppDatabase): Promise<{ archived: number; reconciled: number }> {
  if (!notionEnabled()) return { archived: 0, reconciled: 0 };
  let reconciled = 0;
  const archived = await archiveManagedNotionPages();
  await database.sql`delete from app_private.notion_pages`;

  const { rows: issues } = await database.sql<Selected<
    "issues",
    "id" | "title" | "content" | "category" | "status" | "author_uid" | "support_count" | "support_goal"
  >>`select id, title, content, category, status, author_uid, support_count, support_goal
     from app_private.issues`;

  for (const issue of issues) {
    const authorName = await resolveDisplayName(database, issue.author_uid);
    const pageId = await getOrCreateNotionPage(
      database,
      "issue",
      issue.id,
      issue.title,
      issue.category,
      issue.status,
      authorName,
      issue.support_count,
      issue.support_goal,
    );
    if (!pageId) throw new Error("notion-issue-page-missing");
    await appendCreationTimeline(
      database,
      pageId,
      `migration-0016:issue:${issue.id}`,
      `【遷移快照】${issue.title}`,
      String(issue.content ?? ""),
    );
    reconciled += 1;
  }

  const { rows: facilities } = await database.sql<Selected<
    "facility_reports",
    "id" | "title" | "content" | "location" | "category_id" | "status" | "author_uid" | "affected_count"
  >>`select id, title, content, location, category_id, status, author_uid, affected_count
     from app_private.facility_reports`;

  for (const facility of facilities) {
    const authorName = await resolveDisplayName(database, facility.author_uid);
    const pageId = await getOrCreateNotionPage(
      database,
      "facility",
      facility.id,
      facility.title,
      facility.category_id,
      translateFacilityStatus(facility.status),
      authorName,
      facility.affected_count,
      null,
      "遇到人數",
    );
    if (!pageId) throw new Error("notion-facility-page-missing");
    await appendCreationTimeline(
      database,
      pageId,
      `migration-0016:facility:${facility.id}`,
      `【遷移快照】${facility.title}（${String(facility.location ?? "")}）`,
      String(facility.content ?? ""),
    );
    reconciled += 1;
  }

  const { rows: announcements } = await database.sql<Selected<
    "announcements", "id" | "title" | "content" | "author_uid" | "published_at"
  >>`select id, title, content, author_uid, published_at from app_private.announcements`;
  for (const announcement of announcements) {
    const pageId = await getOrCreateNotionPage(
      database,
      "announcement",
      announcement.id,
      announcement.title,
      "公告",
      "發布",
      await resolveDisplayName(database, announcement.author_uid),
      undefined,
      undefined,
      null,
    );
    if (!pageId) throw new Error("notion-announcement-page-missing");
    await appendCreationTimeline(
      database,
      pageId,
      `migration-0016:announcement:${announcement.id}`,
      `【遷移快照】${announcement.title}`,
      String(announcement.content ?? ""),
    );
    reconciled += 1;
  }

  const { rows: audits } = await database.sql<Selected<
    "admin_audit_log", "id" | "actor_uid" | "action" | "domain" | "target_id" | "detail" | "created_at"
  >>`select id, actor_uid, action, domain, target_id, detail, created_at from app_private.admin_audit_log`;
  for (const audit of audits) {
    const pageId = await getOrCreateNotionPage(
      database,
      "admin-audit",
      String(audit.id),
      `【管理稽核】${audit.action}`,
      "管理操作",
      "已記錄",
      await resolveDisplayName(database, audit.actor_uid),
      undefined,
      undefined,
      null,
    );
    if (!pageId) throw new Error("notion-audit-page-missing");
    await Promise.all([
      ensureDateProperty("操作時間"),
      ensureRichTextProperty("操作類型"),
      ensureRichTextProperty("操作領域"),
      ensureRichTextProperty("目標 ID"),
      ensureRichTextProperty("詳細資料"),
    ]);
    await callNotionAPI(`/pages/${pageId}`, "PATCH", {
      properties: {
        操作時間: dateProperty(audit.created_at),
        操作類型: richTextProperty(audit.action),
        操作領域: richTextProperty(audit.domain),
        "目標 ID": richTextProperty(audit.target_id),
        詳細資料: richTextProperty(JSON.stringify(audit.detail ?? {})),
      },
    });
    await appendTimelineBlockWithDeduplication(
      pageId,
      `migration-0016:admin-audit:${audit.id}`,
      `【遷移稽核】${audit.action}`,
      JSON.stringify(audit.detail ?? {}, null, 2),
    );
    reconciled += 1;
  }

  return { archived, reconciled };
}
