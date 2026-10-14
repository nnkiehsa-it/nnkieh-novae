import type { ActionInput } from "../../../../shared/actions.ts";
import { asRecord } from "../shared/json.ts";
import type { AuthContext, BackendDatabase } from "./types.ts";
import type { Selected } from "../database/schema.ts";
import { categoryCatalogSegments, loadCategoryManagement } from "./category-catalog.ts";
import { settledSegments } from "./segments.ts";

function assertRevision(requested: string, stored: string) {
  if (requested !== stored) throw new Error("configuration-changed");
}

/** Categories as the database stores them: the position in the list is the display order. */
function ordered<T extends object>(categories: T[]) {
  return categories.map((category, sortOrder) => ({ ...category, sortOrder }));
}

export async function* getCategoryCatalog(_input: ActionInput<"getCategoryCatalog">, auth: AuthContext, database: BackendDatabase) {
  yield { data: auth.setupCompleted, key: "setupCompleted" };
  yield* settledSegments(categoryCatalogSegments(database, true));
}

export async function getCategoryManagement(_input: ActionInput<"getCategoryManagement">, _auth: AuthContext, database: BackendDatabase) {
  return await loadCategoryManagement(database);
}

export async function estimateCategoryPolicyChanges(
  input: ActionInput<"estimateCategoryPolicyChanges">,
  auth: AuthContext,
  database: BackendDatabase,
) {
  assertRevision(input.revision, (await loadCategoryManagement(database)).categoryRevision);
  return await database.call("app_api", "backend_estimate_category_policy_changes", {
    actor_uid: auth.uid,
    announcement_comments_enabled: input.announcementCommentsEnabled,
    deleted_issue_category_ids: input.deletedIssueCategoryIds,
    issue_categories: ordered(input.issueCategories),
  });
}

export async function listPlatformJobs(_input: ActionInput<"listPlatformJobs">, auth: AuthContext, database: BackendDatabase) {
  return await database.call("app_api", "backend_list_platform_jobs", { actor_uid: auth.uid, page_limit: 30 });
}

export async function savePlatformSettings(input: ActionInput<"savePlatformSettings">, auth: AuthContext, database: BackendDatabase) {
  await database.sql`select pg_advisory_xact_lock(hashtext('novae:platform-settings'))`;
  assertRevision(input.revision, (await loadCategoryManagement(database)).platformRevision);
  const impact = await database.call("app_api", "backend_save_platform_settings", {
    actor_uid: auth.uid,
    image_settings: input.imageUploads,
    retention_config: input.retention,
  });
  return {
    ...asRecord(impact),
    imageUploads: input.imageUploads,
    retention: input.retention,
    revision: (await loadCategoryManagement(database)).platformRevision,
    success: true,
  };
}

export async function estimateRetentionCleanup(input: ActionInput<"estimateRetentionCleanup">, auth: AuthContext, database: BackendDatabase) {
  assertRevision(input.revision, (await loadCategoryManagement(database)).platformRevision);
  return await database.call("app_api", "backend_estimate_retention_cleanup", {
    actor_uid: auth.uid,
    retention_config: input.retention,
  });
}

export async function saveCategoryManagement(input: ActionInput<"saveCategoryManagement">, auth: AuthContext, database: BackendDatabase) {
  // Every category write uses this row lock, including feature and image-policy writes.
  await database.sql`select singleton from app_private.system_setup where singleton = true for update`;
  assertRevision(input.revision, (await loadCategoryManagement(database)).categoryRevision);
  await database.call("app_api", "backend_save_category_management", {
    actor_uid: auth.uid,
    announcement_comments_enabled: input.announcementCommentsEnabled,
    deleted_facility_category_ids: input.deletedFacilityCategoryIds,
    deleted_issue_category_ids: input.deletedIssueCategoryIds,
    facilities_enabled: input.facilitiesEnabled,
    facility_categories: ordered(input.facilityCategories),
    issue_categories: ordered(input.issueCategories),
    issues_enabled: input.issuesEnabled,
  });
  await database.call("app_api", "backend_save_announcement_image_policy", {
    actor_uid: auth.uid,
    max_images: input.announcementMaxImages,
    comment_max_images: input.announcementCommentMaxImages,
  });
  return { ...await loadCategoryManagement(database), success: true };
}

export async function savePlatformFeatures(input: ActionInput<"savePlatformFeatures">, auth: AuthContext, database: BackendDatabase) {
  return await database.call("app_api", "backend_update_platform_features", {
    actor_uid: auth.uid,
    announcement_comments_enabled: input.announcementCommentsEnabled,
    facilities_enabled: input.facilitiesEnabled,
    issues_enabled: input.issuesEnabled,
  });
}

/** The first administrator's choice of what the school runs; asking twice changes nothing. */
export async function completeInitialSetup(input: ActionInput<"completeInitialSetup">, auth: AuthContext, database: BackendDatabase) {
  if (!auth.isAdmin) throw new Error("permission-denied");
  const alreadyCompleted = { success: true, alreadyCompleted: true };
  if (auth.setupCompleted) return alreadyCompleted;
  const setupState = await database.sqlMaybe<Selected<"system_setup", "completed_at">>`
    select completed_at from app_private.system_setup where singleton = true`;
  if (setupState?.completed_at) return alreadyCompleted;
  const defaultFirst = <T extends { isDefault: boolean }>(categories: T[]) => [
    ...categories.filter((category) => category.isDefault),
    ...categories.filter((category) => !category.isDefault),
  ];
  await database.call("app_api", "backend_complete_initial_setup", {
    actor_uid: auth.uid,
    facilities_enabled: input.facilitiesEnabled,
    issue_categories: input.issuesEnabled ? defaultFirst(input.issueCategories) : [],
    facility_categories: input.facilitiesEnabled ? defaultFirst(input.facilityCategories) : [],
    issues_enabled: input.issuesEnabled,
  });
  return { success: true, alreadyCompleted: false };
}
