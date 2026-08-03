import { asRecord, asString } from "../_shared/http.ts";
import type { AuthContext, BackendSupabase, JsonRecord } from "./types.ts";
import { asBoolean, asNumber } from "./utils.ts";
import { requirePermission } from "./auth.ts";

const CATEGORY_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const READ_ACCESS_VALUES = new Set(["school", "reviewed-school", "owner-admin"]);

export interface RuntimeIssueCategory {
  authorVisible: boolean;
  commentsEnabled: boolean;
  id: string;
  isDefault: boolean;
  label: string;
  readAccess: "owner-admin" | "reviewed-school" | "school";
  responseDeadlineDays: number | null;
  sortOrder: number;
  supportDeadlineDays: number | null;
  supportEnabled: boolean;
  supportGoal: number | null;
}

export interface RuntimeFacilityCategory {
  id: string;
  isDefault: boolean;
  label: string;
  sortOrder: number;
}

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

function issueCategoryResponse(row: Record<string, unknown>): RuntimeIssueCategory {
  return {
    authorVisible: row.author_visible === true,
    commentsEnabled: row.comments_enabled !== false,
    id: asString(row.id),
    isDefault: row.is_default === true,
    label: asString(row.label),
    readAccess: READ_ACCESS_VALUES.has(asString(row.read_access))
      ? asString(row.read_access) as RuntimeIssueCategory["readAccess"]
      : "owner-admin",
    responseDeadlineDays: typeof row.response_deadline_days === "number" ? row.response_deadline_days : null,
    sortOrder: asNumber(row.sort_order, 0),
    supportDeadlineDays: typeof row.support_deadline_days === "number" ? row.support_deadline_days : null,
    supportEnabled: row.support_enabled === true,
    supportGoal: typeof row.support_goal === "number" ? row.support_goal : null,
  };
}

function facilityCategoryResponse(row: Record<string, unknown>): RuntimeFacilityCategory {
  return {
    id: asString(row.id),
    isDefault: row.is_default === true,
    label: asString(row.label),
    sortOrder: asNumber(row.sort_order, 0),
  };
}

async function announcementCommentsSetting(payload: JsonRecord, supabase: BackendSupabase) {
  if (typeof payload.announcementCommentsEnabled === "boolean") {
    return payload.announcementCommentsEnabled;
  }
  const { data, error } = await supabase.schema("app_private").from("system_setup")
    .select("announcement_comments_enabled").eq("singleton", true).single();
  if (error) throw error;
  return data.announcement_comments_enabled !== false;
}

export async function getIssueCategories(supabase: BackendSupabase, includeInactive = false) {
  let query = supabase.schema("app_private").from("issue_categories").select("*")
    .order("sort_order", { ascending: true }).order("created_at", { ascending: true });
  if (!includeInactive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => issueCategoryResponse(row));
}

export async function getFacilityCategories(supabase: BackendSupabase, includeInactive = false) {
  let query = supabase.schema("app_private").from("facility_categories").select("*")
    .order("sort_order", { ascending: true }).order("created_at", { ascending: true });
  if (!includeInactive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => facilityCategoryResponse(row));
}

export async function getIssueCategory(supabase: BackendSupabase, categoryId: string) {
  const { data, error } = await supabase.schema("app_private").from("issue_categories")
    .select("*").eq("id", categoryId).eq("is_active", true).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("invalid-issue-category");
  return issueCategoryResponse(data);
}

export async function issueCategoryPolicyLists(supabase: BackendSupabase) {
  const categories = await getIssueCategories(supabase, true);
  return {
    authorPrivateCategoryIds: categories.filter((category) => !category.authorVisible).map((category) => category.id),
    privateToOwnerCategoryIds: categories.filter((category) => category.readAccess === "owner-admin").map((category) => category.id),
    publicCommentCategoryIds: categories.filter((category) => category.readAccess !== "owner-admin").map((category) => category.id),
    reviewRequiredCategoryIds: categories.filter((category) => category.readAccess === "reviewed-school").map((category) => category.id),
  };
}

export async function loadCategoryCatalog(supabase: BackendSupabase, includeInactive: boolean) {
  const [issueCategories, facilityCategories, setupResult] = await Promise.all([
    getIssueCategories(supabase, includeInactive),
    getFacilityCategories(supabase, includeInactive),
    supabase.schema("app_private").from("system_setup")
      .select("issues_enabled,facilities_enabled,announcement_comments_enabled")
      .eq("singleton", true).single(),
  ]);
  if (setupResult.error) throw setupResult.error;
  return {
    issueCategories,
    facilityCategories,
    features: {
      announcementCommentsEnabled: setupResult.data.announcement_comments_enabled !== false,
      facilitiesEnabled: setupResult.data.facilities_enabled !== false,
      issuesEnabled: setupResult.data.issues_enabled !== false,
    },
  };
}

export async function handleCategoryAction(
  action: string,
  payload: JsonRecord,
  auth: AuthContext,
  supabase: BackendSupabase,
) {
  if (action === "getCategoryCatalog") {
    return { ...await loadCategoryCatalog(supabase, true), setupCompleted: auth.setupCompleted };
  }
  if (action === "getCategoryManagement") {
    requirePermission(auth, "category.manage");
    return { ...await loadCategoryCatalog(supabase, true), setupCompleted: auth.setupCompleted };
  }
  if (action === "saveCategoryManagement") {
    requirePermission(auth, "category.manage");
    const rawIssueCategories = Array.isArray(payload.issueCategories) ? payload.issueCategories : [];
    const rawFacilityCategories = Array.isArray(payload.facilityCategories) ? payload.facilityCategories : [];
    const deletedIssueIds = deletedCategoryIds(payload.deletedIssueCategoryIds);
    const deletedFacilityIds = deletedCategoryIds(payload.deletedFacilityCategoryIds);
    const issuesEnabled = asBoolean(payload.issuesEnabled, true);
    const facilitiesEnabled = asBoolean(payload.facilitiesEnabled, true);
    const announcementCommentsEnabled = await announcementCommentsSetting(payload, supabase);
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
    const { error: saveError } = await supabase.schema("app_api").rpc("backend_save_category_management", {
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
    return { ...await loadCategoryCatalog(supabase, true), success: true };
  }
  if (action === "savePlatformFeatures") {
    requirePermission(auth, "category.manage");
    const announcementCommentsEnabled = await announcementCommentsSetting(payload, supabase);
    const { data, error } = await supabase.schema("app_api").rpc("backend_update_platform_features", {
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
    const { data: setupState, error: setupStateError } = await supabase.schema("app_private")
      .from("system_setup").select("completed_at").eq("singleton", true).maybeSingle();
    if (setupStateError) throw setupStateError;
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
    const { data, error } = await supabase.schema("app_api").rpc("backend_complete_initial_setup", {
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
