import { asRecord } from "../shared/http.ts";
import type { ActionSegment, AuthContext, BackendDatabase, JsonRecord } from "./types.ts";
import { asBoolean } from "./utils.ts";
import { loadPlatformSettings } from "../shared/platform-settings.ts";
import { operationPolicies } from "../shared/operation-policies.ts";
import { settledSegments } from "./segments.ts";

/**
 * What a session needs to start, sent in the order it becomes available.
 *
 * Who the visitor is and what they may do is already known when the request
 * reaches here, so it leaves before either read does and the shell can be
 * drawn while the catalog is still coming. Neither read needs the other, and a
 * Worker invocation is billed for the whole wait, so they leave together.
 */
export async function* getSessionBootstrap(
  payload: JsonRecord,
  auth: AuthContext,
  database: BackendDatabase,
): AsyncGenerator<ActionSegment> {
  const snapshot = database.call("app_api", "backend_get_session_bootstrap_snapshot", {
    actor_email: auth.email,
    actor_is_admin: auth.isAdmin,
    actor_name: auth.name,
    actor_photo_url: auth.photoUrl,
    actor_uid: auth.uid,
    record_visit: asBoolean(payload.recordVisit, false),
  }).then(({ data, error }) => {
    if (error) throw error;
    return asRecord(data);
  });
  const platformSettings = loadPlatformSettings(database);

  yield { data: operationPolicies(), key: "runtimePolicies" };
  yield {
    data: {
      role: auth.roles.includes("platform-admin") ? "admin" : "user",
      roles: auth.roles,
      permissions: auth.permissions,
      managedIssueCategoryIds: auth.managedIssueCategoryIds,
      managedFacilityCategoryIds: auth.managedFacilityCategoryIds,
      setupCompleted: auth.setupCompleted,
    },
    key: "access",
  };
  yield* settledSegments({
    catalog: Promise.all([snapshot, platformSettings]).then(([read, settings]) => ({
      ...asRecord(read.catalog),
      imageUploads: settings.imageUploads,
      setupCompleted: auth.setupCompleted,
    })),
    notificationUnread: snapshot.then((read) => asRecord(read.notificationUnread)),
    runtime: platformSettings.then((settings) => ({
      pushTokenConfirmationDays: settings.retention.pushTokenConfirmationDays,
    })),
    versions: snapshot.then((read) => asRecord(read.versions)),
    visitRecorded: snapshot.then((read) => read.visitRecorded === true),
  });
}
