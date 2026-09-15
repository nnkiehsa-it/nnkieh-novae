import { notionEnabled, notionRequestsMade } from "./notion-api.ts";
import { rebuildFacilityNotionPage } from "./notion-facility-events.ts";
import { rebuildIssueNotionPage } from "./notion-issue-events.ts";
import {
  rebuildAnnouncementNotionPage,
} from "./notion-record-events.ts";
import { rebuildAuditNotionPage } from "./notion-audit-events.ts";
import type { AppDatabaseClient } from "../database/client.ts";
import type { Selected } from "../database/schema.ts";

type AppDatabase = AppDatabaseClient;

const FIRST_UUID = "00000000-0000-0000-0000-000000000000";

/**
 * How much of one Worker invocation's outgoing-request allowance a rebuild may
 * spend.
 *
 * An invocation may make a thousand requests, and the sweep carrying a rebuild
 * is also delivering everything else that is waiting -- which is why this is
 * read against everything the invocation has spent rather than against the
 * rebuild alone. A pass counted only the pages it wrote, and a page is not a
 * fixed price, so a rebuild of a busy archive ran past the allowance and was
 * refused outright with "Too many subrequests", failing the job instead of
 * pausing it. What is left over is headroom for the record the pass is in the
 * middle of when the budget runs out.
 */
const REBUILD_REQUEST_BUDGET = 500;

/** How many records one query reads ahead; the budget decides when to stop. */
const REBUILD_PAGE_SIZE = 50;

/** Where a rebuild had got to when its pass ran out of room. */
export interface NotionRebuildCursor {
  after: string;
  stage: string;
}

/**
 * The four kinds of page a rebuild writes, in the order it writes them.
 *
 * Each stage is read by ascending id rather than by creation time, so the id of
 * the last page written is the whole of the cursor and the pass after it starts
 * exactly where this one stopped.
 */
const STAGES = [
  {
    first: FIRST_UUID,
    key: "issues",
    page: (database: AppDatabase, after: string, limit: number) =>
      database.sql<Selected<"issues", "id">>`select id from app_private.issues
        where id > ${after}::uuid order by id limit ${limit}`,
    write: (database: AppDatabase, id: string) => rebuildIssueNotionPage(database, id),
  },
  {
    first: FIRST_UUID,
    key: "facilities",
    page: (database: AppDatabase, after: string, limit: number) =>
      database.sql<Selected<"facility_reports", "id">>`select id from app_private.facility_reports
        where id > ${after}::uuid order by id limit ${limit}`,
    write: (database: AppDatabase, id: string) => rebuildFacilityNotionPage(database, id),
  },
  {
    first: FIRST_UUID,
    key: "announcements",
    page: (database: AppDatabase, after: string, limit: number) =>
      database.sql<Selected<"announcements", "id">>`select id from app_private.announcements
        where id > ${after}::uuid order by id limit ${limit}`,
    write: (database: AppDatabase, id: string) => rebuildAnnouncementNotionPage(database, id),
  },
  {
    first: "0",
    key: "operations",
    page: (database: AppDatabase, after: string, limit: number) =>
      database.sql<Selected<"admin_audit_log", "id">>`select id from app_private.admin_audit_log
        where id > ${after}::bigint order by id limit ${limit}`,
    write: (database: AppDatabase, id: string) => rebuildAuditNotionPage(database, id),
  },
] as const;

/** How many pages the finished archive will hold, asked once at the start. */
export async function countNotionRebuildTargets(database: AppDatabase) {
  const totals = await database.sqlOne<{ total: number }>`select (
    (select count(*) from app_private.issues)
    + (select count(*) from app_private.facility_reports)
    + (select count(*) from app_private.announcements)
    + (select count(*) from app_private.admin_audit_log))::int as total`;
  return totals.total;
}

/**
 * Rebuilds the Notion archive from canonical PostgreSQL records, a pass at a
 * time.
 *
 * It only writes. Pages that were in the workspace before are the
 * administrator's to remove -- a rebuild that also archived them spent hundreds
 * of requests being refused by Notion before writing anything at all. Content
 * pages carry their current metadata and surviving discussion, and every
 * administrator write becomes its own Chinese system-operation page.
 *
 * One pass writes until its request budget runs out and returns where it
 * stopped, so the job that owns it can report progress and come back for the
 * rest.
 */
export async function reconcileNotionPages(
  database: AppDatabase,
  options: { cursor: NotionRebuildCursor | null },
) {
  if (!notionEnabled()) throw new Error("notion-not-configured");

  let cursor = options.cursor ?? { after: STAGES[0].first, stage: STAGES[0].key };
  let written = 0;
  const budgetSpent = () => notionRequestsMade() >= REBUILD_REQUEST_BUDGET;
  for (const stage of STAGES.slice(STAGES.findIndex((entry) => entry.key === cursor.stage))) {
    let after = cursor.stage === stage.key ? cursor.after : stage.first;
    while (!budgetSpent()) {
      const { rows } = await stage.page(database, after, REBUILD_PAGE_SIZE);
      if (rows.length === 0) break;
      for (const row of rows) {
        await stage.write(database, String(row.id));
        after = String(row.id);
        written += 1;
        if (budgetSpent()) break;
      }
    }
    cursor = { after, stage: stage.key };
    if (budgetSpent()) return { cursor, done: false, written };
  }
  return { cursor: null, done: true, written };
}
