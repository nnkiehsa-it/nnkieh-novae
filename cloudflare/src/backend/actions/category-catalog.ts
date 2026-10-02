import { asString } from "../shared/http.ts";
import type { BackendDatabase } from "./types.ts";
import { asBoolean, asNumber } from "./utils.ts";
import { loadPlatformSettings, platformSettingsFromStoredRows } from "../shared/platform-settings.ts";
import type { Row, Selected } from "../database/schema.ts";

/**
 * The categories a school runs on, as everything else reads them.
 *
 * A category carries the policy of the content filed under it — who may read
 * it, whether the author is shown, how long support stays open — so the read
 * side is shared by every action that has to answer a question about an issue,
 * and is kept apart from the admin screens that rewrite the catalog.
 */
export const READ_ACCESS_VALUES = new Set(["school", "reviewed-school", "owner-admin"]);

export interface RuntimeIssueCategory {
  maxImages: number;
  commentMaxImages: number;
  authorDeleteEnabled: boolean;
  authorVisible: boolean;
  commentsEnabled: boolean;
  id: string;
  isDefault: boolean;
  label: string;
  readAccess: "owner-admin" | "reviewed-school" | "school";
  sortOrder: number;
  supportDeadlineDays: number | null;
  supportEnabled: boolean;
  supportGoal: number | null;
}

export interface RuntimeFacilityCategory {
  maxImages: number;
  authorDeleteEnabled: boolean;
  id: string;
  isDefault: boolean;
  label: string;
  sortOrder: number;
}

function issueCategoryResponse(row: Record<string, unknown>): RuntimeIssueCategory {
  return {
    maxImages: row.max_images as number,
    commentMaxImages: row.comment_max_images as number,
    authorDeleteEnabled: row.author_delete_enabled === true,
    authorVisible: row.author_visible === true,
    commentsEnabled: row.comments_enabled !== false,
    id: asString(row.id),
    isDefault: row.is_default === true,
    label: asString(row.label),
    readAccess: READ_ACCESS_VALUES.has(asString(row.read_access))
      ? asString(row.read_access) as RuntimeIssueCategory["readAccess"]
      : "owner-admin",
    sortOrder: asNumber(row.sort_order, 0),
    supportDeadlineDays: typeof row.support_deadline_days === "number" ? row.support_deadline_days : null,
    supportEnabled: row.support_enabled === true,
    supportGoal: typeof row.support_goal === "number" ? row.support_goal : null,
  };
}

function facilityCategoryResponse(row: Record<string, unknown>): RuntimeFacilityCategory {
  return {
    maxImages: row.max_images as number,
    authorDeleteEnabled: row.author_delete_enabled === true,
    id: asString(row.id),
    isDefault: row.is_default === true,
    label: asString(row.label),
    sortOrder: asNumber(row.sort_order, 0),
  };
}

export async function getIssueCategories(database: BackendDatabase, includeInactive = false): Promise<RuntimeIssueCategory[]> {
  const { rows } = await database.sql<Row<"issue_categories">>`
    select * from app_private.issue_categories
    where ${includeInactive}::boolean or is_active = true
    order by sort_order, created_at`;
  return rows.map((row) => issueCategoryResponse(row));
}

export async function getFacilityCategories(database: BackendDatabase, includeInactive = false): Promise<RuntimeFacilityCategory[]> {
  const { rows } = await database.sql<Row<"facility_categories">>`
    select * from app_private.facility_categories
    where ${includeInactive}::boolean or is_active = true
    order by sort_order, created_at`;
  return rows.map((row) => facilityCategoryResponse(row));
}

export async function getFacilityCategory(database: BackendDatabase, categoryId: string) {
  const category = await database.sqlMaybe<Row<"facility_categories">>`
    select * from app_private.facility_categories where id = ${categoryId} and is_active = true`;
  if (!category) throw new Error("invalid-facility-category");
  return facilityCategoryResponse(category);
}

export async function getIssueCategory(database: BackendDatabase, categoryId: string) {
  const category = await database.sqlMaybe<Row<"issue_categories">>`
    select * from app_private.issue_categories where id = ${categoryId} and is_active = true`;
  if (!category) throw new Error("invalid-issue-category");
  return issueCategoryResponse(category);
}

export async function issueCategoryPolicyLists(database: BackendDatabase) {
  // Policy checks are on the hot read/write path. Avoid materializing full
  // category records when only the stable access columns are needed. Inactive
  // rows stay included because historical issues still carry those category IDs.
  const { rows } = await database.sql<Selected<"issue_categories", "id" | "author_visible" | "read_access">>`
    select id, author_visible, read_access from app_private.issue_categories`;
  return {
    authorPrivateCategoryIds: rows.filter((category) => category.author_visible !== true).map((category) => category.id),
    privateToOwnerCategoryIds: rows.filter((category) => category.read_access === "owner-admin").map((category) => category.id),
    publicCommentCategoryIds: rows.filter((category) => category.read_access !== "owner-admin").map((category) => category.id),
    reviewRequiredCategoryIds: rows.filter((category) => category.read_access === "reviewed-school").map((category) => category.id),
  };
}

export function categoryCatalogSegments(database: BackendDatabase, includeInactive: boolean) {
  const setup = database.sqlOne<Selected<"system_setup", "issues_enabled" | "facilities_enabled" | "announcement_comments_enabled" | "announcement_max_images" | "announcement_comment_max_images">>`
      select issues_enabled, facilities_enabled, announcement_comments_enabled, announcement_max_images, announcement_comment_max_images
      from app_private.system_setup where singleton = true`;
  const platformSettings = loadPlatformSettings(database);
  return {
    facilityCategories: getFacilityCategories(database, includeInactive),
    features: setup.then((value) => ({
      announcementMaxImages: value.announcement_max_images,
      announcementCommentMaxImages: value.announcement_comment_max_images,
      announcementCommentsEnabled: value.announcement_comments_enabled !== false,
      facilitiesEnabled: value.facilities_enabled !== false,
      issuesEnabled: value.issues_enabled !== false,
    })),
    imageUploads: platformSettings.then((settings) => settings.imageUploads),
    issueCategories: getIssueCategories(database, includeInactive),
  };
}

export async function loadCategoryCatalog(database: BackendDatabase, includeInactive: boolean) {
  const reads = categoryCatalogSegments(database, includeInactive);
  const [issueCategories, facilityCategories, features, imageUploads] = await Promise.all([
    reads.issueCategories,
    reads.facilityCategories,
    reads.features,
    reads.imageUploads,
  ]);
  return {
    issueCategories,
    facilityCategories,
    imageUploads,
    features,
  };
}

/** Management data and version tokens come from one PostgreSQL statement snapshot. */
export async function loadCategoryManagement(database: BackendDatabase) {
  const snapshot = await database.sqlOne<{
    setup: Row<"system_setup">;
    issues: Row<"issue_categories">[];
    facilities: Row<"facility_categories">[];
    settings: Selected<"runtime_settings", "key" | "value">[];
    category_revision: string;
    platform_revision: string;
  }>`
    with configuration as (
      select to_jsonb(setup) as setup,
        coalesce((select jsonb_agg(to_jsonb(category) order by sort_order, created_at, id)
          from app_private.issue_categories category), '[]'::jsonb) as issues,
        coalesce((select jsonb_agg(to_jsonb(category) order by sort_order, created_at, id)
          from app_private.facility_categories category), '[]'::jsonb) as facilities,
        coalesce((select jsonb_agg(jsonb_build_object('key', key, 'value', value) order by key)
          from app_private.runtime_settings where key in ('image_upload_settings', 'data_retention_settings')), '[]'::jsonb) as settings
      from app_private.system_setup setup where singleton = true
    )
    select *, md5(jsonb_build_object('setup', setup, 'issues', issues, 'facilities', facilities)::text) as category_revision,
      md5(settings::text) as platform_revision
    from configuration`;
  const platformSettings = platformSettingsFromStoredRows(snapshot.settings);
  return {
    categoryRevision: snapshot.category_revision,
    platformRevision: snapshot.platform_revision,
    platformSettings,
    issueCategories: snapshot.issues.map((row) => issueCategoryResponse(row)),
    facilityCategories: snapshot.facilities.map((row) => facilityCategoryResponse(row)),
    imageUploads: platformSettings.imageUploads,
    features: {
      announcementMaxImages: snapshot.setup.announcement_max_images,
      announcementCommentMaxImages: snapshot.setup.announcement_comment_max_images,
      announcementCommentsEnabled: snapshot.setup.announcement_comments_enabled !== false,
      facilitiesEnabled: snapshot.setup.facilities_enabled !== false,
      issuesEnabled: snapshot.setup.issues_enabled !== false,
    },
    setupCompleted: snapshot.setup.completed_at !== null,
  };
}
