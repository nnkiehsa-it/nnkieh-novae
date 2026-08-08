import { asRecord } from "../_shared/http.ts";
import type { AuthContext, BackendSupabase, JsonRecord } from "./types.ts";
import { asBoolean } from "./utils.ts";

export async function getSessionBootstrap(
  payload: JsonRecord,
  auth: AuthContext,
  supabase: BackendSupabase,
) {
  const { data, error } = await supabase.schema("app_api")
    .rpc("backend_get_session_bootstrap_snapshot", {
      actor_email: auth.email,
      actor_is_admin: auth.isAdmin,
      actor_name: auth.name,
      actor_photo_url: auth.photoUrl,
      actor_uid: auth.uid,
      record_visit: asBoolean(payload.recordVisit, false),
    });
  if (error) throw error;
  const snapshot = asRecord(data);
  const catalog = asRecord(snapshot.catalog);

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
    notificationUnread: asRecord(snapshot.notificationUnread),
    versions: asRecord(snapshot.versions),
    visitRecorded: snapshot.visitRecorded === true,
  };
}
