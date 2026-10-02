import { asRecord, asString } from "../shared/http.ts";
import type { AuthContext, BackendDatabase, JsonRecord } from "./types.ts";
import { requirePermission } from "./auth.ts";
import {
  platformSettingsFromInput,
} from "../shared/platform-settings.ts";
import type { Selected } from "../database/schema.ts";
import { categoryCatalogSegments, loadCategoryManagement, READ_ACCESS_VALUES } from "./category-catalog.ts";
import { settledSegments } from "./segments.ts";

const CATEGORY_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

function booleanSetting(value: unknown) {
  if (typeof value !== "boolean") throw new Error("validation-required");
  return value;
}

function categoryArray(value: unknown) {
  if (!Array.isArray(value)) throw new Error("validation-required");
  return value;
}

function assertRevision(requested: unknown, stored: string) {
  if (typeof requested !== "string" || !/^[a-f0-9]{32}$/u.test(requested)) throw new Error("validation-required");
  if (requested !== stored) throw new Error("configuration-changed");
}

function imageLimit(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 20) {
    throw new Error("validation-required");
  }
  return value;
}

function positiveInteger(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 2_147_483_647) {
    throw new Error("validation-required");
  }
  return value;
}

function deletedCategoryIds(value: unknown) {
  if (!Array.isArray(value)) throw new Error("validation-required");
  const ids = value.map((id) => asString(id).trim());
  if (
    ids.some((id) => !CATEGORY_ID_PATTERN.test(id))
    || new Set(ids).size !== ids.length
  ) {
    throw new Error("validation-required");
  }
  return ids;
}

function categoryIdentity(value: JsonRecord) {
  const id = asString(value.id).trim();
  const label = asString(value.label).trim();
  if (!CATEGORY_ID_PATTERN.test(id) || label.length < 1 || label.length > 40) {
    throw new Error("validation-required");
  }
  return { id, label };
}

function issueCategoryInput(value: unknown, sortOrder: number) {
  const record = asRecord(value);
  const identity = categoryIdentity(record);
  const readAccess = asString(record.readAccess);
  if (!READ_ACCESS_VALUES.has(readAccess)) throw new Error("validation-required");
  const requestedAuthorVisible = booleanSetting(record.authorVisible);
  const authorVisible = readAccess === "owner-admin" ? true : requestedAuthorVisible;
  const supportEnabled = booleanSetting(record.supportEnabled);
  return {
    ...identity,
    maxImages: imageLimit(record.maxImages),
    commentMaxImages: imageLimit(record.commentMaxImages),
    authorDeleteEnabled: booleanSetting(record.authorDeleteEnabled),
    authorVisible,
    commentsEnabled: booleanSetting(record.commentsEnabled),
    readAccess,
    sortOrder,
    supportDeadlineDays: supportEnabled ? positiveInteger(record.supportDeadlineDays) : null,
    supportEnabled,
    supportGoal: supportEnabled ? positiveInteger(record.supportGoal) : null,
  };
}

function facilityCategoryInput(value: unknown, sortOrder: number) {
  const record = asRecord(value);
  return {
    ...categoryIdentity(record),
    maxImages: imageLimit(record.maxImages),
    authorDeleteEnabled: booleanSetting(record.authorDeleteEnabled),
    sortOrder,
  };
}

function assertCategoryCollection(categories: Array<{ id: string; isDefault: boolean }>) {
  if (new Set(categories.map((category) => category.id)).size !== categories.length) {
    throw new Error("validation-required");
  }
  if (categories.length > 0 && categories.filter((category) => category.isDefault).length !== 1) {
    throw new Error("validation-required");
  }
}

export async function handleCategoryAction(
  action: string,
  payload: JsonRecord,
  auth: AuthContext,
  database: BackendDatabase,
) {
  if (action === "getCategoryCatalog") {
    return (async function* () {
      yield { data: auth.setupCompleted, key: "setupCompleted" };
      yield* settledSegments(categoryCatalogSegments(database, true));
    })();
  }
  if (action === "getCategoryManagement") {
    requirePermission(auth, "category.manage");
    return loadCategoryManagement(database);
  }
  if (action === "estimateCategoryPolicyChanges") {
    requirePermission(auth, "category.manage");
    assertRevision(payload.revision, (await loadCategoryManagement(database)).categoryRevision);
    const rawIssueCategories = categoryArray(payload.issueCategories);
    const issueCategories = rawIssueCategories.map((value, index) => ({
      ...issueCategoryInput(value, index),
      isDefault: booleanSetting(asRecord(value).isDefault),
    }));
    const { data, error } = await database.call("app_api", "backend_estimate_category_policy_changes", {
      actor_uid: auth.uid,
      announcement_comments_enabled: booleanSetting(payload.announcementCommentsEnabled),
      deleted_issue_category_ids: deletedCategoryIds(payload.deletedIssueCategoryIds),
      issue_categories: issueCategories,
    });
    if (error) throw error;
    return asRecord(data);
  }
  if (action === "listPlatformJobs") {
    requirePermission(auth, "category.manage");
    const { data, error } = await database.call("app_api", "backend_list_platform_jobs", {
      actor_uid: auth.uid,
      page_limit: 30,
    });
    if (error) throw error;
    return asRecord(data);
  }
  if (action === "savePlatformSettings") {
    requirePermission(auth, "category.manage");
    const settings = platformSettingsFromInput(payload);
    await database.sql`select pg_advisory_xact_lock(hashtext('novae:platform-settings'))`;
    assertRevision(payload.revision, (await loadCategoryManagement(database)).platformRevision);
    const { data, error } = await database.call("app_api", "backend_save_platform_settings", {
      actor_uid: auth.uid,
      image_settings: { ...settings.imageUploads },
      retention_config: { ...settings.retention },
    });
    if (error) throw error;
    return { ...settings, ...asRecord(data), revision: (await loadCategoryManagement(database)).platformRevision, success: true };
  }
  if (action === "estimateRetentionCleanup") {
    requirePermission(auth, "category.manage");
    const settings = platformSettingsFromInput(payload);
    assertRevision(payload.revision, (await loadCategoryManagement(database)).platformRevision);
    const { data, error } = await database.call("app_api", "backend_estimate_retention_cleanup", {
      actor_uid: auth.uid,
      retention_config: { ...settings.retention },
    });
    if (error) throw error;
    return asRecord(data);
  }
  if (action === "saveCategoryManagement") {
    requirePermission(auth, "category.manage");
    const rawIssueCategories = categoryArray(payload.issueCategories);
    const rawFacilityCategories = categoryArray(payload.facilityCategories);
    const deletedIssueIds = deletedCategoryIds(payload.deletedIssueCategoryIds);
    const deletedFacilityIds = deletedCategoryIds(payload.deletedFacilityCategoryIds);
    const issuesEnabled = booleanSetting(payload.issuesEnabled);
    const facilitiesEnabled = booleanSetting(payload.facilitiesEnabled);
    const announcementCommentsEnabled = booleanSetting(payload.announcementCommentsEnabled);
    const issueCategories = rawIssueCategories.map((value, index) => {
      const requested = asRecord(value);
      return {
        ...issueCategoryInput(requested, index),
        isDefault: booleanSetting(requested.isDefault),
      };
    });
    const facilityCategories = rawFacilityCategories.map((value, index) => {
      const requested = asRecord(value);
      return {
        ...facilityCategoryInput(requested, index),
        isDefault: booleanSetting(requested.isDefault),
      };
    });
    if ((issuesEnabled && issueCategories.length === 0) || (facilitiesEnabled && facilityCategories.length === 0)) {
      throw new Error("validation-required");
    }
    assertCategoryCollection(issueCategories);
    assertCategoryCollection(facilityCategories);
    if (
      issueCategories.some((category) => deletedIssueIds.includes(category.id))
      || facilityCategories.some((category) => deletedFacilityIds.includes(category.id))
    ) {
      throw new Error("validation-required");
    }
    // Every category write uses this row lock, including feature and image-policy writes.
    await database.sql`select singleton from app_private.system_setup where singleton = true for update`;
    assertRevision(payload.revision, (await loadCategoryManagement(database)).categoryRevision);
    const { error: saveError } = await database.call("app_api", "backend_save_category_management", {
      actor_uid: auth.uid,
      announcement_comments_enabled: announcementCommentsEnabled,
      deleted_facility_category_ids: deletedFacilityIds,
      deleted_issue_category_ids: deletedIssueIds,
      facilities_enabled: facilitiesEnabled,
      facility_categories: facilityCategories,
      issue_categories: issueCategories,
      issues_enabled: issuesEnabled,
    });
    if (saveError) throw saveError;
    const { error: imageError } = await database.call("app_api", "backend_save_announcement_image_policy", {
      actor_uid: auth.uid,
      max_images: imageLimit(payload.announcementMaxImages),
      comment_max_images: imageLimit(payload.announcementCommentMaxImages),
    });
    if (imageError) throw imageError;
    return { ...await loadCategoryManagement(database), success: true };
  }
  if (action === "savePlatformFeatures") {
    requirePermission(auth, "category.manage");
    const announcementCommentsEnabled = booleanSetting(payload.announcementCommentsEnabled);
    const { data, error } = await database.call("app_api", "backend_update_platform_features", {
      actor_uid: auth.uid,
      announcement_comments_enabled: announcementCommentsEnabled,
      facilities_enabled: booleanSetting(payload.facilitiesEnabled),
      issues_enabled: booleanSetting(payload.issuesEnabled),
    });
    if (error) throw error;
    return asRecord(data);
  }
  if (action === "completeInitialSetup") {
    if (!auth.isAdmin) throw new Error("permission-denied");
    if (auth.setupCompleted) return { success: true, setupCompleted: true, alreadyCompleted: true };
    const setupState = await database.sqlMaybe<Selected<"system_setup", "completed_at">>`
      select completed_at from app_private.system_setup where singleton = true`;
    if (setupState?.completed_at) return { success: true, setupCompleted: true, alreadyCompleted: true };
    const rawIssueCategories = categoryArray(payload.issueCategories);
    const rawFacilityCategories = categoryArray(payload.facilityCategories);
    const issuesEnabled = booleanSetting(payload.issuesEnabled);
    const facilitiesEnabled = booleanSetting(payload.facilitiesEnabled);
    const issueCategories = issuesEnabled
      ? rawIssueCategories.map((value, index) => ({
        ...issueCategoryInput(value, index),
        isDefault: booleanSetting(asRecord(value).isDefault),
      }))
      : [];
    const facilityCategories = facilitiesEnabled
      ? rawFacilityCategories.map((value, index) => ({
        ...facilityCategoryInput(value, index),
        isDefault: booleanSetting(asRecord(value).isDefault),
      }))
      : [];
    if ((issuesEnabled && issueCategories.length < 1) || (facilitiesEnabled && facilityCategories.length < 1)) {
      throw new Error("validation-required");
    }
    assertCategoryCollection(issueCategories);
    assertCategoryCollection(facilityCategories);
    const defaultFirst = <T extends { isDefault: boolean }>(categories: T[]) => [
      ...categories.filter((category) => category.isDefault),
      ...categories.filter((category) => !category.isDefault),
    ];
    const { data, error } = await database.call("app_api", "backend_complete_initial_setup", {
      actor_uid: auth.uid,
      facilities_enabled: facilitiesEnabled,
      issue_categories: defaultFirst(issueCategories),
      facility_categories: defaultFirst(facilityCategories),
      issues_enabled: issuesEnabled,
    });
    if (error) throw error;
    return asRecord(data);
  }
  throw new Error("invalid-action");
}
