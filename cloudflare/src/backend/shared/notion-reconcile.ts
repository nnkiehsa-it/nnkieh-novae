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
      await callNotionAPI(`/pages/${page.id}`, "PATCH", { archived: true });
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
  const { error: mappingError } = await database.table("app_private", "notion_pages").delete();
  if (mappingError) throw mappingError;

  const { data: issues, error: issueError } = await database
    .table("app_private", "issues")
    .select("id,title,content,category,status,author_uid,support_count,support_goal");
  if (issueError) throw issueError;

  for (const issue of issues ?? []) {
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

  const { data: facilities, error: facilityError } = await database
    .table("app_private", "facility_reports")
    .select("id,title,content,location,category_id,status,author_uid,affected_count");
  if (facilityError) throw facilityError;

  for (const facility of facilities ?? []) {
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

  const { data: announcements, error: announcementError } = await database
    .table("app_private", "announcements")
    .select("id,title,content,author_uid,published_at");
  if (announcementError) throw announcementError;
  for (const announcement of announcements ?? []) {
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

  const { data: audits, error: auditError } = await database
    .table("app_private", "admin_audit_log")
    .select("id,actor_uid,action,domain,target_id,detail,created_at");
  if (auditError) throw auditError;
  for (const audit of audits ?? []) {
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
