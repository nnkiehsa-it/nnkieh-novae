import { asRecord, asString } from "../shared/http.ts";
import type { AuthContext, BackendDatabase, JsonRecord } from "./types.ts";
import { asBoolean, asNumber } from "./utils.ts";
import { requirePermission } from "./auth.ts";
import {
  loadPlatformSettings,
  platformSettingsFromInput,
} from "../shared/platform-settings.ts";
import type { Selected } from "../database/schema.ts";
import { categoryCatalogSegments, loadCategoryCatalog, READ_ACCESS_VALUES } from "./category-catalog.ts";
import { settledSegments } from "./segments.ts";

const CATEGORY_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

function nullablePositiveInteger(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Math.round(asNumber(value, 0));
  if (number < 1) throw new Error("validation-required");
  return number;
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
  if (readAccess !== "owner-admin" && typeof record.authorVisible !== "boolean") {
    throw new Error("validation-required");
  }
  const authorVisible = readAccess === "owner-admin" ? true : asBoolean(record.authorVisible);
  const supportEnabled = asBoolean(record.supportEnabled);
  return {
    ...identity,
    authorVisible,
    commentsEnabled: asBoolean(record.commentsEnabled, true),
    readAccess,
    responseDeadlineDays: nullablePositiveInteger(record.responseDeadlineDays),
    sortOrder,
    supportDeadlineDays: supportEnabled ? nullablePositiveInteger(record.supportDeadlineDays) : null,
    supportEnabled,
    supportGoal: supportEnabled ? nullablePositiveInteger(record.supportGoal) : null,
  };
}

function facilityCategoryInput(value: unknown, sortOrder: number) {
  return { ...categoryIdentity(asRecord(value)), sortOrder };
}

function assertCategoryCollection(categories: Array<{ id: string; isDefault: boolean }>) {
  if (new Set(categories.map((category) => category.id)).size !== categories.length) {
    throw new Error("validation-required");
  }
  if (categories.length > 0 && categories.filter((category) => category.isDefault).length !== 1) {
    throw new Error("validation-required");
  }
}

async function announcementCommentsSetting(payload: JsonRecord, database: BackendDatabase) {
  if (typeof payload.announcementCommentsEnabled === "boolean") {
    return payload.announcementCommentsEnabled;
  }
  const setup = await database.sqlOne<Selected<"system_setup", "announcement_comments_enabled">>`
    select announcement_comments_enabled from app_private.system_setup where singleton = true`;
  return setup.announcement_comments_enabled !== false;
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
    return {
      ...await loadCategoryCatalog(database, true),
      platformSettings: await loadPlatformSettings(database),
      setupCompleted: auth.setupCompleted,
    };
  }
  if (action === "estimateCategoryPolicyChanges") {
    requirePermission(auth, "category.manage");
    const rawIssueCategories = Array.isArray(payload.issueCategories) ? payload.issueCategories : [];
    const issueCategories = rawIssueCategories.map((value, index) => ({
      ...issueCategoryInput(value, index),
      isDefault: asBoolean(asRecord(value).isDefault),
    }));
    const { data, error } = await database.call("app_api", "backend_estimate_category_policy_changes", {
      actor_uid: auth.uid,
      announcement_comments_enabled: await announcementCommentsSetting(payload, database),
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
    const { data, error } = await database.call("app_api", "backend_save_platform_settings", {
      actor_uid: auth.uid,
      image_settings: { ...settings.imageUploads },
      retention_config: { ...settings.retention },
    });
    if (error) throw error;
    return { ...settings, ...asRecord(data), success: true };
  }
  if (action === "estimateRetentionCleanup") {
    requirePermission(auth, "category.manage");
    const settings = platformSettingsFromInput(payload);
    const { data, error } = await database.call("app_api", "backend_estimate_retention_cleanup", {
      actor_uid: auth.uid,
      retention_config: { ...settings.retention },
    });
    if (error) throw error;
    return asRecord(data);
  }
  if (action === "saveCategoryManagement") {
    requirePermission(auth, "category.manage");
    const rawIssueCategories = Array.isArray(payload.issueCategories) ? payload.issueCategories : [];
    const rawFacilityCategories = Array.isArray(payload.facilityCategories) ? payload.facilityCategories : [];
    const deletedIssueIds = deletedCategoryIds(payload.deletedIssueCategoryIds);
    const deletedFacilityIds = deletedCategoryIds(payload.deletedFacilityCategoryIds);
    const issuesEnabled = asBoolean(payload.issuesEnabled, true);
    const facilitiesEnabled = asBoolean(payload.facilitiesEnabled, true);
    const announcementCommentsEnabled = await announcementCommentsSetting(payload, database);
    const issueCategories = rawIssueCategories.map((value, index) => {
      const requested = asRecord(value);
      return {
        ...issueCategoryInput(requested, index),
        isDefault: asBoolean(requested.isDefault),
      };
    });
    const facilityCategories = rawFacilityCategories.map((value, index) => {
      const requested = asRecord(value);
      return {
        ...facilityCategoryInput(requested, index),
        isDefault: asBoolean(requested.isDefault),
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
    return { ...await loadCategoryCatalog(database, true), success: true };
  }
  if (action === "savePlatformFeatures") {
    requirePermission(auth, "category.manage");
    const announcementCommentsEnabled = await announcementCommentsSetting(payload, database);
    const { data, error } = await database.call("app_api", "backend_update_platform_features", {
      actor_uid: auth.uid,
      announcement_comments_enabled: announcementCommentsEnabled,
      facilities_enabled: asBoolean(payload.facilitiesEnabled, true),
      issues_enabled: asBoolean(payload.issuesEnabled, true),
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
    const rawIssueCategories = Array.isArray(payload.issueCategories) ? payload.issueCategories : [];
    const rawFacilityCategories = Array.isArray(payload.facilityCategories) ? payload.facilityCategories : [];
    const issuesEnabled = asBoolean(payload.issuesEnabled, true);
    const facilitiesEnabled = asBoolean(payload.facilitiesEnabled, true);
    const issueCategories = issuesEnabled
      ? rawIssueCategories.map((value, index) => ({
        ...issueCategoryInput(value, index),
        isDefault: asBoolean(asRecord(value).isDefault, index === 0),
      }))
      : [];
    const facilityCategories = facilitiesEnabled
      ? rawFacilityCategories.map((value, index) => ({
        ...facilityCategoryInput(value, index),
        isDefault: asBoolean(asRecord(value).isDefault, index === 0),
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
