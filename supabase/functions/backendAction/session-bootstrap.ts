import { asBoolean } from "./utils.ts";
import { loadCategoryCatalog } from "./categories.ts";
import type { AuthContext, BackendSupabase, JsonRecord } from "./types.ts";
import { loadContentVersions } from "./content-versions.ts";

async function recordVisitIfRequested(
  payload: JsonRecord,
  auth: AuthContext,
  supabase: BackendSupabase,
) {
  if (asBoolean(payload.recordVisit, false) !== true) return false;
  const { error } = await supabase.schema("app_private").from("user_profiles").upsert({
    uid: auth.uid,
    email: auth.email.toLowerCase(),
    display_name: auth.name,
    photo_url: auth.photoUrl,
    last_seen_at: new Date().toISOString(),
  }, { onConflict: "uid" });
  if (error) throw error;
  return true;
}

export async function getSessionBootstrap(
  payload: JsonRecord,
  auth: AuthContext,
  supabase: BackendSupabase,
) {
  const [catalog, versions, unreadHint, visitRecorded] = await Promise.all([
    loadCategoryCatalog(supabase, true),
    loadContentVersions(supabase),
    supabase.schema("app_api").rpc("backend_get_notification_unread_hint", {
      actor_is_admin: auth.isAdmin,
      actor_uid: auth.uid,
    }).then(({ data, error }) => {
      if (error) throw error;
      const record = data && typeof data === "object" && !Array.isArray(data)
        ? data as Record<string, unknown>
        : {};
      return { hasUnread: record.hasUnread === true };
    }),
    recordVisitIfRequested(payload, auth, supabase),
  ]);

  return {
    access: {
      role: auth.roles.includes("platform-admin") ? "admin" : "user",
      roles: auth.roles,
      permissions: auth.permissions,
      managedIssueCategoryIds: auth.managedIssueCategoryIds,
      managedFacilityCategoryIds: auth.managedFacilityCategoryIds,
      setupCompleted: auth.setupCompleted,
    },
    catalog: {
      ...catalog,
      setupCompleted: auth.setupCompleted,
    },
    notificationUnread: unreadHint,
    versions,
    visitRecorded,
  };
}
