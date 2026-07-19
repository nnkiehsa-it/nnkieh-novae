import {
  createCloudinaryAuthenticatedImageUrl,
  sha256Hex,
  uploadCloudinaryAuthenticatedImage,
} from "../_shared/cloudinary.ts";
import { asString } from "../_shared/http.ts";
import type { AuthContext, BackendSupabase, JsonRecord } from "./types.ts";
import { requirePermission } from "./auth.ts";
import { getFacilityCategories, getIssueCategories } from "./categories.ts";

const ASSIGNABLE_ROLES = new Set(["platform-admin", "proposal-manager", "announcement-manager", "general-affairs"]);

export function isUserAction(action: string) {
  return action === "recordPlatformVisit"
    || action === "getCurrentUserRole"
    || action === "listRoleAssignments"
    || action === "setUserRoles"
    || action === "cacheUserAvatar"
    || action === "getUserAvatarUrls";
}

export async function handleUserAction(
  action: string,
  payload: JsonRecord,
  auth: AuthContext,
  supabase: BackendSupabase,
) {
  if (action === "recordPlatformVisit") {
    const { error } = await supabase.schema("app_private").from("user_profiles").upsert({
      uid: auth.uid,
      email: auth.email.toLowerCase(),
      display_name: auth.name,
      photo_url: auth.photoUrl,
      last_seen_at: new Date().toISOString(),
    }, { onConflict: "uid" });
    if (error) throw error;
    return { success: true };
  }

  if (action === "getCurrentUserRole") {
    return {
      role: auth.roles.includes("platform-admin") ? "admin" : "user",
      roles: auth.roles,
      permissions: auth.permissions,
      managedIssueCategoryIds: auth.managedIssueCategoryIds,
      managedFacilityCategoryIds: auth.managedFacilityCategoryIds,
      setupCompleted: auth.setupCompleted,
    };
  }

  if (action === "listRoleAssignments") {
    requirePermission(auth, "role.manage");
    const rawQuery = asString(payload.query).trim();
    if (!rawQuery) return { users: [] };
    const query = rawQuery.includes("@") ? rawQuery.toLowerCase() : rawQuery;
    let profilesQuery = supabase.schema("app_private").from("user_profiles")
      .select("uid,email,display_name,cached_photo_url,photo_url").limit(1);
    profilesQuery = query.includes("@")
      ? profilesQuery.eq("email", query)
      : profilesQuery.eq("uid", query);
    const { data: profiles, error: profileError } = await profilesQuery;
    if (profileError) throw profileError;
    const uids = (profiles ?? []).map((profile) => profile.uid);
    const { data: assignments, error: assignmentError } = uids.length
      ? await supabase.schema("app_private").from("user_role_assignments").select("uid,role_code").in("uid", uids)
      : { data: [], error: null };
    if (assignmentError) throw assignmentError;
    const { data: categoryAssignments, error: categoryAssignmentError } = uids.length
      ? await supabase.schema("app_private").from("user_issue_category_assignments").select("uid,category_id").in("uid", uids)
      : { data: [], error: null };
    if (categoryAssignmentError) throw categoryAssignmentError;
    const { data: facilityCategoryAssignments, error: facilityCategoryAssignmentError } = uids.length
      ? await supabase.schema("app_private").from("user_facility_category_assignments").select("uid,category_id").in("uid", uids)
      : { data: [], error: null };
    if (facilityCategoryAssignmentError) throw facilityCategoryAssignmentError;
    const roleMap = new Map<string, string[]>();
    for (const assignment of assignments ?? []) {
      roleMap.set(assignment.uid, [...(roleMap.get(assignment.uid) ?? []), assignment.role_code]);
    }
    const categoryMap = new Map<string, string[]>();
    for (const assignment of categoryAssignments ?? []) {
      categoryMap.set(assignment.uid, [...(categoryMap.get(assignment.uid) ?? []), assignment.category_id]);
    }
    const facilityCategoryMap = new Map<string, string[]>();
    for (const assignment of facilityCategoryAssignments ?? []) {
      facilityCategoryMap.set(assignment.uid, [...(facilityCategoryMap.get(assignment.uid) ?? []), assignment.category_id]);
    }
    return { users: (profiles ?? []).map((profile) => ({
      uid: profile.uid, email: profile.email ?? null, name: profile.display_name ?? profile.email ?? profile.uid,
      photoUrl: profile.cached_photo_url ?? profile.photo_url ?? null,
      roles: roleMap.get(profile.uid) ?? [],
      managedIssueCategoryIds: categoryMap.get(profile.uid) ?? [],
      managedFacilityCategoryIds: facilityCategoryMap.get(profile.uid) ?? [],
    })) };
  }

  if (action === "setUserRoles") {
    requirePermission(auth, "role.manage");
    const uid = asString(payload.uid);
    const requestedRoles = [...new Set(Array.isArray(payload.roles) ? payload.roles.map((value) => asString(value)).filter((role) => ASSIGNABLE_ROLES.has(role) && role !== "proposal-manager") : [])];
    // The platform administrator is the single highest-level role. Keeping
    // scoped roles alongside it is redundant and makes later revocation hard
    // to reason about, so persist only the platform role when it is selected.
    const roles = requestedRoles.includes("platform-admin") ? ["platform-admin"] : requestedRoles;
    const [issueCategories, facilityCategories] = await Promise.all([
      getIssueCategories(supabase), getFacilityCategories(supabase),
    ]);
    const validIssueCategoryIds = new Set(issueCategories.map((category) => category.id));
    const validFacilityCategoryIds = new Set(facilityCategories.map((category) => category.id));
    const managedIssueCategoryIds = roles.includes("platform-admin")
      ? []
      : [...new Set(Array.isArray(payload.managedIssueCategoryIds)
        ? payload.managedIssueCategoryIds.map((value) => asString(value)).filter((id) => validIssueCategoryIds.has(id))
        : [])];
    const managedFacilityCategoryIds = roles.includes("platform-admin")
      ? []
      : [...new Set(Array.isArray(payload.managedFacilityCategoryIds)
        ? payload.managedFacilityCategoryIds.map((value) => asString(value)).filter((id) => validFacilityCategoryIds.has(id))
        : [])];
    if (!uid) throw new Error("not-found");
    const { data: currentRows, error: currentError } = await supabase.schema("app_private")
      .from("user_role_assignments").select("role_code").eq("uid", uid);
    if (currentError) throw currentError;
    const current = new Set((currentRows ?? []).map((row) => row.role_code));
    if (current.has("platform-admin") && !roles.includes("platform-admin")) {
      const { count, error } = await supabase.schema("app_private").from("user_role_assignments")
        .select("uid", { count: "exact", head: true }).eq("role_code", "platform-admin");
      if (error) throw error;
      if ((count ?? 0) <= 1) throw new Error("last-platform-admin");
    }
    const grants = roles.filter((role) => !current.has(role));
    const revokes = [...current].filter((role) => !roles.includes(role));
    if (revokes.length) {
      const { error } = await supabase.schema("app_private").from("user_role_assignments").delete().eq("uid", uid).in("role_code", revokes);
      if (error) throw error;
    }
    if (grants.length) {
      const { error } = await supabase.schema("app_private").from("user_role_assignments").insert(
        grants.map((role_code) => ({ uid, role_code, granted_by: auth.uid })),
      );
      if (error) throw error;
    }
    if (grants.length || revokes.length) {
      const { error } = await supabase.schema("app_private").from("role_assignment_audit").insert([
        ...grants.map((role_code) => ({ uid, role_code, operation: "grant", actor_uid: auth.uid })),
        ...revokes.map((role_code) => ({ uid, role_code, operation: "revoke", actor_uid: auth.uid })),
      ]);
      if (error) throw error;
    }
    const { error: clearCategoryError } = await supabase.schema("app_private")
      .from("user_issue_category_assignments").delete().eq("uid", uid);
    if (clearCategoryError) throw clearCategoryError;
    if (managedIssueCategoryIds.length > 0) {
      const { error: categoryInsertError } = await supabase.schema("app_private")
        .from("user_issue_category_assignments").insert(managedIssueCategoryIds.map((category_id) => ({
          category_id,
          granted_by: auth.uid,
          uid,
        })));
      if (categoryInsertError) throw categoryInsertError;
    }
    const { error: clearFacilityCategoryError } = await supabase.schema("app_private")
      .from("user_facility_category_assignments").delete().eq("uid", uid);
    if (clearFacilityCategoryError) throw clearFacilityCategoryError;
    if (managedFacilityCategoryIds.length > 0) {
      const { error: facilityCategoryInsertError } = await supabase.schema("app_private")
        .from("user_facility_category_assignments").insert(managedFacilityCategoryIds.map((category_id) => ({
          category_id, granted_by: auth.uid, notify_on_created: true, uid,
        })));
      if (facilityCategoryInsertError) throw facilityCategoryInsertError;
    }
    return { success: true, roles, managedIssueCategoryIds, managedFacilityCategoryIds };
  }

  if (action === "cacheUserAvatar") {
    const sourceUrl = auth.photoUrl;
    if (!sourceUrl) return { photoUrl: null };
    const parsedSourceUrl = new URL(sourceUrl);
    if (
      parsedSourceUrl.protocol !== "https:"
      || !parsedSourceUrl.hostname.toLowerCase().endsWith(".googleusercontent.com")
    ) throw new Error("validation-invalid");

    const { data: existing, error: existingError } = await supabase
      .schema("app_private")
      .from("user_profiles")
      .select("avatar_hash,avatar_public_id,avatar_source_url,avatar_version,cached_photo_url")
      .eq("uid", auth.uid)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing?.avatar_source_url === sourceUrl && existing.cached_photo_url) {
      return { photoUrl: existing.cached_photo_url };
    }


    const imageResponse = await fetch(sourceUrl, {
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
    });
    if (!imageResponse.ok) {
      throw new Error(`avatar-fetch-failed:${imageResponse.status}`);
    }
    const contentType = imageResponse.headers.get("content-type") ?? "";
    const contentLength = Number(imageResponse.headers.get("content-length") ?? 0);
    if (!contentType.startsWith("image/") || contentLength > 5 * 1024 * 1024) {
      throw new Error("validation-invalid");
    }
    const imageBuffer = await imageResponse.arrayBuffer();
    if (imageBuffer.byteLength > 5 * 1024 * 1024) throw new Error("validation-invalid");
    const avatarHash = await sha256Hex(imageBuffer);
    if (existing?.avatar_hash === avatarHash && existing.cached_photo_url) {
      const { error } = await supabase.schema("app_private").from("user_profiles").upsert({
        uid: auth.uid,
        avatar_source_url: sourceUrl,
        display_name: auth.name,
        photo_url: sourceUrl,
        updated_at: new Date().toISOString(),
      }, { onConflict: "uid" });
      if (error) throw error;
      return { photoUrl: existing.cached_photo_url };
    }

    const nextVersion = Number(existing?.avatar_version ?? 0) + 1;
    const nextPublicId = `srp/avatars/${auth.uid}_${nextVersion}`;
    await uploadCloudinaryAuthenticatedImage(
      nextPublicId,
      new Blob([imageBuffer], { type: contentType }),
    );
    const cachedPhotoUrl = await createCloudinaryAuthenticatedImageUrl(nextPublicId);
    const previousPublicId = asString(existing?.avatar_public_id);

    const { error } = await supabase.schema("app_private").from("user_profiles").upsert({
      uid: auth.uid,
      avatar_hash: avatarHash,
      avatar_public_id: nextPublicId,
      avatar_source_url: sourceUrl,
      avatar_version: nextVersion,
      display_name: auth.name,
      photo_url: sourceUrl,
      cached_photo_url: cachedPhotoUrl,
      updated_at: new Date().toISOString(),
    }, { onConflict: "uid" });
    if (error) throw error;
    if (previousPublicId && previousPublicId !== nextPublicId) {
      const { error: deletionError } = await supabase.schema("app_private").from("deletion_jobs").insert({
        cloudinary_public_id: previousPublicId,
        target_id: auth.uid,
        target_type: "avatar",
      });
      if (deletionError) throw deletionError;
    }
    return { photoUrl: cachedPhotoUrl };
  }

  const uids = Array.isArray(payload.uids) ? payload.uids.map((uid) => asString(uid)).filter(Boolean).slice(0, 50) : [];
  const { data, error } = await supabase.schema("app_private").from("user_profiles").select("uid,cached_photo_url,photo_url").in("uid", uids);
  if (error) throw error;
  return {
    avatars: Object.fromEntries((data ?? []).map((profile) => [
      profile.uid,
      profile.cached_photo_url ?? profile.photo_url ?? null,
    ])),
  };
}
