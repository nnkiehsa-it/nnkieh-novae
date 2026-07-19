import { asRecord, asString } from "../_shared/http.ts";
import { canManageFacilityCategory, hasPermission, requireFacilityCategoryPermission } from "./auth.ts";
import { getFacilityCategories } from "./categories.ts";
import type { AuthContext, BackendSupabase, JsonRecord } from "./types.ts";
import { validateMarkdownUploadsBeforeCreate } from "./uploads.ts";
import { asNumber, asUuid } from "./utils.ts";
import { INPUT_LIMITS, optionalText, requiredMediaContent, requiredText } from "./validation.ts";

const VALID_STATUSES = new Set(["processing", "completed", "unable-to-handle"]);

function policy(auth: AuthContext, categoryId: string) {
  return {
    actor_uid: auth.uid,
    actor_can_manage: canManageFacilityCategory(auth, categoryId),
  };
}

async function selectFacilityCategory(supabase: BackendSupabase, facilityId: string) {
  const { data, error } = await supabase.schema("app_private").from("facility_reports")
    .select("category_id").eq("id", facilityId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("not-found");
  return data.category_id;
}

export async function handleFacilityAction(
  action: string,
  payload: JsonRecord,
  auth: AuthContext,
  supabase: BackendSupabase,
): Promise<JsonRecord> {
  if (action === "createFacility") {
    const title = requiredText(payload.title, "title", INPUT_LIMITS.title).trim();
    const location = requiredText(payload.location, "location", INPUT_LIMITS.facilityLocation).trim();
    const content = requiredMediaContent(payload.content, "content", INPUT_LIMITS.content, INPUT_LIMITS.contentStorage);
    const categoryId = asString(payload.categoryId);
    const categories = await getFacilityCategories(supabase);
    if (!categories.some((category) => category.id === categoryId)) throw new Error("invalid-facility-category");
    await validateMarkdownUploadsBeforeCreate(supabase, auth.uid, content, "facility");
    const { data, error } = await supabase.schema("app_api").rpc("backend_create_facility", {
      actor_uid: auth.uid,
      actor_name: auth.name,
      actor_photo_url: auth.photoUrl,
      facility_title: title,
      facility_location: location,
      facility_content: content,
      facility_category: categoryId,
    });
    if (error) throw error;
    return { facility: data };
  }

  const facilityId = asUuid(payload.facilityId);
  if (!facilityId) throw new Error("not-found");

  const categoryId = await selectFacilityCategory(supabase, facilityId);

  if (action === "getFacility") {
    const { data, error } = await supabase.schema("app_api").rpc("backend_get_facility", {
      facility_id: facilityId,
      ...policy(auth, categoryId),
    });
    if (error) throw error;
    return { facility: data };
  }

  if (action === "toggleFacilityAffected") {
    const { data, error } = await supabase.schema("app_api").rpc("backend_toggle_facility_affected", {
      facility_id: facilityId,
      actor_uid: auth.uid,
    });
    if (error) throw error;
    return asRecord(data);
  }

  if (action === "updateFacilityStatus") {
    requireFacilityCategoryPermission(auth, categoryId);
    const status = asString(payload.status);
    if (!VALID_STATUSES.has(status)) throw new Error("invalid-status");
    const resultContent = optionalText(payload.resultContent, "facility-result", INPUT_LIMITS.facilityResult).trim() || null;
    const { data, error } = await supabase.schema("app_api").rpc("backend_update_facility_status", {
      facility_id: facilityId,
      next_status: status,
      result_content: resultContent,
      ...policy(auth, categoryId),
    });
    if (error) throw error;
    return { facility: data };
  }

  if (action === "deleteFacility") {
    const { data, error } = await supabase.schema("app_api").rpc("backend_delete_facility", {
      facility_id: facilityId,
      ...policy(auth, categoryId),
    });
    if (error) throw error;
    return asRecord(data);
  }

  throw new Error("invalid-action");
}

export async function listFacilities(payload: JsonRecord, auth: AuthContext, supabase: BackendSupabase) {
  const cursor = asRecord(payload.cursor);
  const { data, error } = await supabase.schema("app_api").rpc("backend_list_facilities", {
    actor_uid: auth.uid,
    actor_can_manage: hasPermission(auth, "facility.manage"),
    bucket: asString(payload.bucket, "active") === "closed" ? "closed" : "active",
    status_filter: asString(payload.status),
    search_query: optionalText(payload.query, "search", INPUT_LIMITS.search).trim(),
    sort_name: asString(payload.sort) === "most-affected" ? "most-affected" : "latest",
    cursor_created_at: asString(cursor.createdAt) || null,
    cursor_number: cursor.affectedCount === undefined ? null : Math.round(asNumber(cursor.affectedCount, 0)),
    cursor_id: asUuid(cursor.id) || null,
    page_size: Math.round(asNumber(payload.pageSize, 20)),
  });
  if (error) throw error;
  const result = asRecord(data);
  const facilities = Array.isArray(result.facilities) ? result.facilities.map((value) => {
    const facility = asRecord(value);
    return { ...facility, canManageFacility: canManageFacilityCategory(auth, asString(facility.category_id)) } as JsonRecord;
  }) : [];
  const last = facilities.at(-1);
  return {
    facilities,
    hasMore: result.hasMore === true,
    cursor: result.hasMore === true && last ? {
      id: asString(last.id),
      createdAt: asString(last.created_at),
      affectedCount: asNumber(last.affected_count, 0),
    } : null,
  };
}
