import type { FacilityCategory, IssueCategory } from "../../../../shared/contracts/categories.ts";
import type { BackendDatabase } from "./types.ts";
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
function issueCategoryResponse(row: Row<"issue_categories">): IssueCategory {
  return {
    maxImages: row.max_images,
    commentMaxImages: row.comment_max_images,
    authorDeleteEnabled: row.author_delete_enabled,
    authorVisible: row.author_visible,
    commentsEnabled: row.comments_enabled,
    id: row.id,
    isDefault: row.is_default,
    label: row.label,
    readAccess: row.read_access,
    sortOrder: row.sort_order,
    supportDeadlineDays: row.support_deadline_days,
    supportEnabled: row.support_enabled,
    supportGoal: row.support_goal,
  };
}

function facilityCategoryResponse(row: Row<"facility_categories">): FacilityCategory {
  return {
    maxImages: row.max_images,
    authorDeleteEnabled: row.author_delete_enabled,
    id: row.id,
    isDefault: row.is_default,
    label: row.label,
    sortOrder: row.sort_order,
  };
}

async function getIssueCategories(database: BackendDatabase, includeInactive = false): Promise<IssueCategory[]> {
  const { rows } = await database.sql<Row<"issue_categories">>`
    select * from app_private.issue_categories
    where ${includeInactive}::boolean or is_active = true
    order by sort_order, created_at`;
  return rows.map((row) => issueCategoryResponse(row));
}

export async function getFacilityCategories(database: BackendDatabase, includeInactive = false): Promise<FacilityCategory[]> {
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
      announcementCommentsEnabled: value.announcement_comments_enabled,
      facilitiesEnabled: value.facilities_enabled,
      issuesEnabled: value.issues_enabled,
    })),
    imageUploads: platformSettings.then((settings) => settings.imageUploads),
    issueCategories: getIssueCategories(database, includeInactive),
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
      announcementCommentsEnabled: snapshot.setup.announcement_comments_enabled,
      facilitiesEnabled: snapshot.setup.facilities_enabled,
      issuesEnabled: snapshot.setup.issues_enabled,
    },
    setupCompleted: snapshot.setup.completed_at !== null,
  };
}
