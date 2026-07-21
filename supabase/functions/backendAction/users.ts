import {
  createCloudinaryAuthenticatedImageUrl,
  sha256Hex,
  uploadCloudinaryAuthenticatedImage,
} from "../_shared/cloudinary.ts";
import { asString } from "../_shared/http.ts";
import type { AuthContext, BackendSupabase, JsonRecord } from "./types.ts";
import { requirePermission } from "./auth.ts";

const ACCESS_LIST_LIMIT = 100;
const ACCESS_SCOPE_KINDS = new Set(["announcement", "facility", "issue"]);

async function scopedAccessUids(payload: JsonRecord, supabase: BackendSupabase) {
  const scopeKind = asString(payload.scopeKind);
  if (!scopeKind) return null;
  if (!ACCESS_SCOPE_KINDS.has(scopeKind)) throw new Error("validation-required");
  const categoryId = asString(payload.categoryId).trim();
  if ((scopeKind === "issue" || scopeKind === "facility") && !categoryId) {
    throw new Error("validation-required");
  }

  const roleQuery = scopeKind === "announcement"
    ? supabase.schema("app_private").from("user_role_assignments")
      .select("uid").eq("role_code", "announcement-manager").limit(ACCESS_LIST_LIMIT + 1)
    : Promise.resolve({ data: [], error: null });
  const categoryQuery = scopeKind === "issue"
    ? supabase.schema("app_private").from("user_issue_category_assignments")
      .select("uid").eq("category_id", categoryId).limit(ACCESS_LIST_LIMIT + 1)
    : scopeKind === "facility"
    ? supabase.schema("app_private").from("user_facility_category_assignments")
      .select("uid").eq("category_id", categoryId).limit(ACCESS_LIST_LIMIT + 1)
    : Promise.resolve({ data: [], error: null });
  const [roleResult, categoryResult] = await Promise.all([roleQuery, categoryQuery]);
  if (roleResult.error) throw roleResult.error;
  if (categoryResult.error) throw categoryResult.error;
  const allUids = [
    ...(roleResult.data ?? []).map((row) => row.uid),
    ...(categoryResult.data ?? []).map((row) => row.uid),
  ];
  const uniqueUids = [...new Set(allUids)];
  return { truncated: uniqueUids.length > ACCESS_LIST_LIMIT, uids: uniqueUids.slice(0, ACCESS_LIST_LIMIT) };
}

async function accessUsersForUids(uids: string[], supabase: BackendSupabase) {
  if (uids.length === 0) return [];
  const { data: profiles, error: profileError } = await supabase.schema("app_private").from("user_profiles")
    .select("uid,email,display_name,cached_photo_url,photo_url").in("uid", uids)
    .order("display_name", { ascending: true });
  if (profileError) throw profileError;
  const [roleResult, issueResult, facilityResult] = await Promise.all([
    supabase.schema("app_private").from("user_role_assignments").select("uid,role_code").in("uid", uids),
    supabase.schema("app_private").from("user_issue_category_assignments").select("uid,category_id").in("uid", uids),
    supabase.schema("app_private").from("user_facility_category_assignments").select("uid,category_id").in("uid", uids),
  ]);
  if (roleResult.error) throw roleResult.error;
  if (issueResult.error) throw issueResult.error;
  if (facilityResult.error) throw facilityResult.error;
  const roles = new Map<string, string[]>();
  const issueCategories = new Map<string, string[]>();
  const facilityCategories = new Map<string, string[]>();
  for (const assignment of roleResult.data ?? []) {
    roles.set(assignment.uid, [...(roles.get(assignment.uid) ?? []), assignment.role_code]);
  }
  for (const assignment of issueResult.data ?? []) {
    issueCategories.set(assignment.uid, [...(issueCategories.get(assignment.uid) ?? []), assignment.category_id]);
  }
  for (const assignment of facilityResult.data ?? []) {
    facilityCategories.set(assignment.uid, [...(facilityCategories.get(assignment.uid) ?? []), assignment.category_id]);
  }
  return (profiles ?? []).map((profile) => ({
    uid: profile.uid,
    email: profile.email ?? null,
    name: profile.display_name ?? profile.email ?? profile.uid,
    photoUrl: profile.cached_photo_url ?? profile.photo_url ?? null,
    roles: roles.get(profile.uid) ?? [],
    managedIssueCategoryIds: issueCategories.get(profile.uid) ?? [],
    managedFacilityCategoryIds: facilityCategories.get(profile.uid) ?? [],
  }));
}

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
    const scoped = await scopedAccessUids(payload, supabase);
    if (!rawQuery && !scoped) return { truncated: false, users: [] };
    const query = rawQuery.includes("@") ? rawQuery.toLowerCase() : rawQuery;
    let uids = scoped?.uids ?? [];
    if (rawQuery) {
      let profileQuery = supabase.schema("app_private").from("user_profiles").select("uid").limit(1);
      profileQuery = query.includes("@") ? profileQuery.eq("email", query) : profileQuery.eq("uid", query);
      const { data, error } = await profileQuery;
      if (error) throw error;
      uids = (data ?? []).map((profile) => profile.uid);
    }
    return { truncated: scoped?.truncated ?? false, users: await accessUsersForUids(uids, supabase) };
  }

  if (action === "setUserRoles") {
    requirePermission(auth, "role.manage");
    const uid = asString(payload.uid).trim();
    if (!uid || !Array.isArray(payload.roles) || !Array.isArray(payload.managedIssueCategoryIds)
      || !Array.isArray(payload.managedFacilityCategoryIds)) throw new Error("validation-required");
    const roles = payload.roles.map((value) => asString(value));
    const managedIssueCategoryIds = payload.managedIssueCategoryIds.map((value) => asString(value));
    const managedFacilityCategoryIds = payload.managedFacilityCategoryIds.map((value) => asString(value));
    const { data, error } = await supabase.schema("app_api").rpc("backend_set_user_access", {
      actor_uid: auth.uid,
      target_uid: uid,
      requested_roles: roles,
      issue_category_ids: managedIssueCategoryIds,
      facility_category_ids: managedFacilityCategoryIds,
    });
    if (error) throw error;
    return data;
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
