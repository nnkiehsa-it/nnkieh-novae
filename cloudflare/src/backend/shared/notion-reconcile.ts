import { callNotionAPI, getDataSourceId, notionEnabled } from "./notion-api.ts";
import { rebuildFacilityNotionPage } from "./notion-facility-events.ts";
import { rebuildIssueNotionPage } from "./notion-issue-events.ts";
import {
  rebuildAnnouncementNotionPage,
} from "./notion-record-events.ts";
import { rebuildAuditNotionPage } from "./notion-audit-events.ts";
import type { AppDatabaseClient } from "../database/client.ts";
import type { Selected } from "../database/schema.ts";

type AppDatabase = AppDatabaseClient;

/** Archives every page owned by Novae before the canonical database is rebuilt. */
async function archiveManagedNotionPages(): Promise<number> {
  const dataSourceId = await getDataSourceId();
  let archived = 0;
  while (true) {
    const response = (await callNotionAPI(`/data_sources/${dataSourceId}/query`, "POST", {
      filter: { property: "Novae ID", rich_text: { is_not_empty: true } },
      page_size: 100,
    })) as {
      has_more?: boolean;
      results?: Array<{ id?: string }>;
    };
    for (const page of response.results ?? []) {
      if (!page.id) throw new Error("notion-managed-page-id-missing");
      await callNotionAPI(`/pages/${page.id}`, "PATCH", { in_trash: true });
      archived += 1;
    }
    if (!response.has_more) break;
  }
  return archived;
}

/**
 * Rebuilds the Notion archive only from canonical PostgreSQL records.
 *
 * Content pages include their current metadata and surviving discussion. Every
 * administrator write becomes its own Chinese system-operation page. Retrying a
 * partial rebuild archives the partial output and starts from the same source.
 */
export async function reconcileNotionPages(database: AppDatabase) {
  if (!notionEnabled()) throw new Error("notion-not-configured");
  const archived = await archiveManagedNotionPages();
  await database.sql`delete from app_private.notion_pages`;

  const { rows: issues } = await database.sql<Selected<"issues", "id">>`
    select id from app_private.issues order by created_at, id`;
  for (const issue of issues) await rebuildIssueNotionPage(database, issue.id);

  const { rows: facilities } = await database.sql<Selected<"facility_reports", "id">>`
    select id from app_private.facility_reports order by created_at, id`;
  for (const facility of facilities) await rebuildFacilityNotionPage(database, facility.id);

  const { rows: announcements } = await database.sql<Selected<"announcements", "id">>`
    select id from app_private.announcements order by published_at, id`;
  for (const announcement of announcements) {
    await rebuildAnnouncementNotionPage(database, announcement.id);
  }

  const { rows: audits } = await database.sql<Selected<"admin_audit_log", "id">>`
    select id from app_private.admin_audit_log order by created_at, id`;
  for (const audit of audits) await rebuildAuditNotionPage(database, String(audit.id));

  const reconciled = issues.length + facilities.length + announcements.length + audits.length;
  return {
    announcements: announcements.length,
    archived,
    facilities: facilities.length,
    issues: issues.length,
    operations: audits.length,
    reconciled,
  };
}
