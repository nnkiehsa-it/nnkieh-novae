import * as v from "valibot";
import type { ActionInput } from "../../../../shared/actions.ts";
import { Count } from "../../../../shared/contract.ts";
import { FACILITY_ACTIONS, Facility } from "../../../../shared/contracts/facilities.ts";
import { canManageFacilityCategory, requireFacilityCategoryPermission } from "./auth.ts";
import { getFacilityCategories, getFacilityCategory } from "./category-catalog.ts";
import type { AuthContext, BackendDatabase } from "./types.ts";
import { validateMarkdownUploadsBeforeCreate } from "./upload-markdown.ts";
import { INPUT_LIMITS, optionalMediaContent, optionalText, requiredText } from "./validation.ts";
import type { Selected } from "../database/schema.ts";

async function selectFacilityCategory(database: BackendDatabase, facilityId: string) {
  const facility = await database.sqlMaybe<Selected<"facility_reports", "category_id">>`
    select category_id from app_private.facility_reports where id = ${facilityId}`;
  if (!facility) throw new Error("not-found");
  return facility.category_id;
}

export async function listFacilities(input: ActionInput<"listFacilities">, auth: AuthContext, database: BackendDatabase) {
  const { cursor } = input;
  return v.parse(FACILITY_ACTIONS.listFacilities.output, await database.call("app_api", "backend_list_facilities_snapshot", {
    actor_uid: auth.uid,
    actor_is_admin: auth.isAdmin,
    bucket: input.bucket,
    category_filter: input.categoryId,
    status_filter: input.status,
    search_query: optionalText(input.query, "search", INPUT_LIMITS.search),
    sort_name: input.sort,
    cursor_created_at: cursor?.createdAt ?? null,
    cursor_number: cursor?.affectedCount ?? null,
    cursor_id: cursor?.id ?? null,
    page_size: input.pageSize,
    managed_category_ids: auth.managedFacilityCategoryIds,
  }));
}

/** A report as the database answers it: everything but what the reader may do with it. */
const StoredFacility = v.omit(Facility, ["canDeleteFacility"]);

export async function getFacility(input: ActionInput<"getFacility">, auth: AuthContext, database: BackendDatabase) {
  const categoryId = await selectFacilityCategory(database, input.facilityId);
  const canManage = canManageFacilityCategory(auth, categoryId);
  const facility = v.parse(StoredFacility, await database.call("app_api", "backend_get_facility", {
    facility_id: input.facilityId,
    actor_uid: auth.uid,
    actor_can_manage: canManage,
  }));
  const canDeleteFacility = canManage
    || (facility.authorUid === auth.uid && (await getFacilityCategory(database, categoryId)).authorDeleteEnabled);
  return { facility: { ...facility, canDeleteFacility } };
}

export async function createFacility(input: ActionInput<"createFacility">, auth: AuthContext, database: BackendDatabase) {
  requiredText(input.title, "title", INPUT_LIMITS.title);
  requiredText(input.location, "location", INPUT_LIMITS.facilityLocation);
  const content = optionalMediaContent(input.content, "content", INPUT_LIMITS.content, INPUT_LIMITS.contentStorage);
  const category = (await getFacilityCategories(database)).find((entry) => entry.id === input.categoryId);
  if (!category) throw new Error("invalid-facility-category");
  await validateMarkdownUploadsBeforeCreate(database, auth.uid, content, "facility", input.categoryId);
  const facility = v.parse(StoredFacility, await database.call("app_api", "backend_create_facility", {
    actor_uid: auth.uid,
    facility_title: input.title,
    facility_location: input.location,
    facility_content: content,
    facility_category: input.categoryId,
  }));
  const canDeleteFacility = canManageFacilityCategory(auth, input.categoryId) || category.authorDeleteEnabled;
  return { facility: { ...facility, canDeleteFacility } };
}

export async function toggleFacilityAffected(input: ActionInput<"toggleFacilityAffected">, auth: AuthContext, database: BackendDatabase) {
  return v.parse(
    v.object({ affected: v.boolean(), affectedCount: Count }),
    await database.call("app_api", "backend_toggle_facility_affected", {
      facility_id: input.facilityId,
      actor_uid: auth.uid,
    }),
  );
}

export async function updateFacilityStatus(input: ActionInput<"updateFacilityStatus">, auth: AuthContext, database: BackendDatabase) {
  const categoryId = await selectFacilityCategory(database, input.facilityId);
  requireFacilityCategoryPermission(auth, categoryId);
  const resultContent = optionalText(input.resultContent, "facility-result", INPUT_LIMITS.facilityResult) || null;
  const facility = v.parse(StoredFacility, await database.call("app_api", "backend_update_facility_status", {
    facility_id: input.facilityId,
    next_status: input.status,
    result_content: resultContent,
    actor_uid: auth.uid,
    actor_can_manage: canManageFacilityCategory(auth, categoryId),
  }));
  // Only a manager reaches this point, and a manager may always delete.
  return { facility: { ...facility, canDeleteFacility: true } };
}

export async function deleteFacility(input: ActionInput<"deleteFacility">, auth: AuthContext, database: BackendDatabase) {
  const categoryId = await selectFacilityCategory(database, input.facilityId);
  const category = await getFacilityCategory(database, categoryId);
  await database.call("app_api", "backend_delete_facility", {
    facility_id: input.facilityId,
    actor_uid: auth.uid,
    actor_can_manage: canManageFacilityCategory(auth, categoryId),
    author_delete_enabled: category.authorDeleteEnabled,
  });
  return { success: true as const };
}
