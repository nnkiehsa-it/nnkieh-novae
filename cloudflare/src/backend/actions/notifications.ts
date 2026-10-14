import type { ActionInput } from "../../../../shared/actions.ts";
import type { NotificationCursor, NotificationSource } from "../../../../shared/contracts/notifications.ts";
import type { AuthContext, BackendDatabase } from "./types.ts";
import { optionalText, requiredText } from "./validation.ts";
import { settledSegments } from "./segments.ts";

const PUSH_TOKEN_LIMITS = {
  deviceId: 160,
  platform: 120,
  token: 4096,
  userAgent: 512,
} as const;

function listPage(
  database: BackendDatabase,
  auth: AuthContext,
  source: NotificationSource,
  pageSize: number,
  cursor: NotificationCursor | null,
) {
  return database.call("app_api", "backend_list_notifications", {
    actor_uid: auth.uid,
    actor_is_admin: auth.isAdmin,
    notification_source: source,
    page_size: pageSize,
    cursor_id: cursor?.id ?? null,
    // Kept as sent: PostgreSQL cursors carry microseconds a Date would drop.
    cursor_created_at: cursor?.createdAt ?? null,
  });
}

export async function* getNotificationSnapshot(input: ActionInput<"getNotificationSnapshot">, auth: AuthContext, database: BackendDatabase) {
  const sources = [...new Set(input.sources)].filter((source) => source !== "admin" || auth.isAdmin);
  const pages = Promise.all(sources.map(async (source) => [source, await listPage(database, auth, source, 30, null)] as const))
    .then((entries) => Object.fromEntries(entries));
  const state = database.call("app_api", "backend_get_notification_read_state", { actor_uid: auth.uid });

  yield { data: new Date().toISOString(), key: "openedAt" };
  yield* settledSegments({ pages, state });
}

export async function listNotificationPages(input: ActionInput<"listNotificationPages">, auth: AuthContext, database: BackendDatabase) {
  const pages = await Promise.all(input.requests.map(async (request) => {
    if (request.source === "admin" && !auth.isAdmin) throw new Error("permission-denied");
    return [request.source, await listPage(database, auth, request.source, request.pageSize, request.cursor)] as const;
  }));
  return { pages: Object.fromEntries(pages) };
}

export async function getNotificationReadState(_input: ActionInput<"getNotificationReadState">, auth: AuthContext, database: BackendDatabase) {
  return { state: await database.call("app_api", "backend_get_notification_read_state", { actor_uid: auth.uid }) };
}

export async function getNotificationUnreadHint(_input: ActionInput<"getNotificationUnreadHint">, auth: AuthContext, database: BackendDatabase) {
  return await database.call("app_api", "backend_get_notification_unread_hint", {
    actor_is_admin: auth.isAdmin,
    actor_uid: auth.uid,
  });
}

export async function markNotificationsOpened(_input: ActionInput<"markNotificationsOpened">, auth: AuthContext, database: BackendDatabase) {
  return await database.call("app_api", "backend_mark_notifications_opened", {
    actor_uid: auth.uid,
    opened_at: new Date().toISOString(),
  });
}

export async function unregisterPushToken(input: ActionInput<"unregisterPushToken">, auth: AuthContext, database: BackendDatabase) {
  const deviceId = requiredText(input.deviceId, "deviceId", PUSH_TOKEN_LIMITS.deviceId);
  await database.sql`delete from app_private.push_tokens where uid = ${auth.uid} and device_id = ${deviceId}`;
  return { success: true };
}

export async function registerPushToken(input: ActionInput<"registerPushToken">, auth: AuthContext, database: BackendDatabase) {
  return await database.call("app_api", "backend_register_push_token", {
    actor_uid: auth.uid,
    device_id: requiredText(input.deviceId, "deviceId", PUSH_TOKEN_LIMITS.deviceId),
    token: requiredText(input.token, "token", PUSH_TOKEN_LIMITS.token),
    permission: input.permission,
    platform: optionalText(input.platform, "platform", PUSH_TOKEN_LIMITS.platform),
    user_agent: optionalText(input.userAgent, "userAgent", PUSH_TOKEN_LIMITS.userAgent),
  });
}

export async function updatePlatformAdminNotificationPreferences(
  input: ActionInput<"updatePlatformAdminNotificationPreferences">,
  auth: AuthContext,
  database: BackendDatabase,
) {
  if (!auth.isAdmin) throw new Error("permission-denied");
  return await database.call("app_api", "backend_update_platform_admin_notification_preferences", {
    actor_uid: auth.uid,
    comment_notifications_enabled: input.preferences.commentNotifications,
    facility_notifications_enabled: input.preferences.facilityNotifications,
    issue_notifications_enabled: input.preferences.issueNotifications,
  });
}

export async function getPlatformAdminNotificationPreferences(
  _input: ActionInput<"getPlatformAdminNotificationPreferences">,
  auth: AuthContext,
  database: BackendDatabase,
) {
  if (!auth.isAdmin) throw new Error("permission-denied");
  return await database.call("app_api", "backend_get_platform_admin_notification_preferences", { actor_uid: auth.uid });
}

export async function getPushNotificationPreference(input: ActionInput<"getPushNotificationPreference">, auth: AuthContext, database: BackendDatabase) {
  return await database.call("app_api", "backend_push_notification_preference", {
    actor_uid: auth.uid,
    device_id: input.deviceId,
    permission: input.permission,
  });
}
