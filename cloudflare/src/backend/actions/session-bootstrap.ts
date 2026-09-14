import { asRecord } from "../shared/http.ts";
import type { AuthContext, BackendDatabase, JsonRecord } from "./types.ts";
import { asBoolean } from "./utils.ts";
import { loadPlatformSettings } from "../shared/platform-settings.ts";
import { operationPolicies } from "../shared/operation-policies.ts";

export async function getSessionBootstrap(
  payload: JsonRecord,
  auth: AuthContext,
  database: BackendDatabase,
) {
  // Neither read needs the other, and a Worker invocation is billed for the
  // whole wait, so they leave together.
  const [{ data, error }, platformSettings] = await Promise.all([
    database.call("app_api", "backend_get_session_bootstrap_snapshot", {
      actor_email: auth.email,
      actor_is_admin: auth.isAdmin,
      actor_name: auth.name,
      actor_photo_url: auth.photoUrl,
      actor_uid: auth.uid,
      record_visit: asBoolean(payload.recordVisit, false),
    }),
    loadPlatformSettings(database),
  ]);
  if (error) throw error;
  const snapshot = asRecord(data);
  const catalog = asRecord(snapshot.catalog);

  return {
    runtimePolicies: operationPolicies(),
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
      imageUploads: platformSettings.imageUploads,
      setupCompleted: auth.setupCompleted,
    },
    notificationUnread: asRecord(snapshot.notificationUnread),
    runtime: {
      pushTokenConfirmationDays: platformSettings.retention.pushTokenConfirmationDays,
    },
    versions: asRecord(snapshot.versions),
    visitRecorded: snapshot.visitRecorded === true,
  };
}
