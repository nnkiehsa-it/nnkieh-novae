import { asRecord, asString } from "../_shared/http.ts";
import { RATE_LIMITS } from "../_shared/rate-limits.ts";
import { claimFixedWindowRateLimit } from "../_shared/upstash-rate-limit.ts";
import type { AuthContext, BackendSupabase, JsonRecord } from "./types.ts";
import { asNumber, readCursor, readCursorDate, asUuid, utcHourWindow } from "./utils.ts";
import { requiredText } from "./validation.ts";

const PUSH_TOKEN_LIMITS = {
  deviceId: 160,
  platform: 120,
  token: 4096,
  userAgent: 512,
} as const;

export function isNotificationAction(action: string) {
  return action === "listNotifications"
    || action === "getNotificationSnapshot"
    || action === "getNotificationReadState"
    || action === "markNotificationsOpened"
    || action === "getPushNotificationPreference"
    || action === "registerPushToken"
    || action === "unregisterPushToken"
    || action === "updatePushNotificationPreferences";
}

function readNotificationSource(payload: JsonRecord) {
  const source = asString(payload.source, "broadcast");
  return source === "admin" || source === "user" ? source : "broadcast";
}

function readDeviceId(payload: JsonRecord) {
  return asString(payload.deviceId);
}

function readPermission(payload: JsonRecord) {
  const permission = asString(payload.permission, "default");
  return permission === "default" || permission === "denied" || permission === "granted"
    ? permission
    : "default";
}

function optionalLimitedText(value: unknown, field: string, maxLength: number) {
  const text = asString(value);
  if (text.length > maxLength) throw new Error(`${field}-too-long`);
  return text;
}

export async function handleNotificationAction(
  action: string,
  payload: JsonRecord,
  auth: AuthContext,
  supabase: BackendSupabase,
) {
  if (action === "getNotificationSnapshot") {
    const requestedSources = Array.isArray(payload.sources)
      ? payload.sources.map((source) => readNotificationSource({ source }))
        .filter((source, index, items) => items.indexOf(source) === index)
      : ["broadcast", "user"];
    const sources = requestedSources.filter((source) => source !== "admin" || auth.isAdmin);
    const [pageEntries, stateResult] = await Promise.all([
      Promise.all(sources.map(async (source) => {
        const { data, error } = await supabase.schema("app_api").rpc("backend_list_notifications", {
          actor_uid: auth.uid,
          actor_is_admin: auth.isAdmin,
          notification_source: source,
          page_size: 10,
          cursor_id: null,
          cursor_created_at: null,
        });
        if (error) throw error;
        return [source, data] as const;
      })),
      supabase.schema("app_api").rpc("backend_get_notification_read_state", {
        actor_uid: auth.uid,
      }),
    ]);
    if (stateResult.error) throw stateResult.error;
    return {
      pages: Object.fromEntries(pageEntries),
      state: stateResult.data,
    };
  }

  if (action === "listNotifications") {
    const cursor = readCursor(payload);
    const { data, error } = await supabase.schema("app_api").rpc("backend_list_notifications", {
      actor_uid: auth.uid,
      actor_is_admin: auth.isAdmin,
      notification_source: readNotificationSource(payload),
      page_size: Math.min(Math.max(Math.round(asNumber(payload.pageSize, 10)), 1), 30),
      cursor_id: asUuid(cursor.id) || null,
      cursor_created_at: readCursorDate(cursor, "createdAtMs", "created_at") || null,
    });
    if (error) throw error;
    return data;
  }

  if (action === "getNotificationReadState") {
    const { data, error } = await supabase.schema("app_api").rpc("backend_get_notification_read_state", {
      actor_uid: auth.uid,
    });
    if (error) throw error;
    return { state: data };
  }

  if (action === "markNotificationsOpened") {
    const openedAt = new Date().toISOString();
    const { data, error } = await supabase.schema("app_api").rpc("backend_mark_notifications_opened", {
      actor_uid: auth.uid,
      opened_at: openedAt,
    });
    if (error) throw error;
    return data;
  }

  if (action === "registerPushToken") {
    await claimFixedWindowRateLimit(auth.uid, "push-token.write", utcHourWindow(), RATE_LIMITS.pushTokenWriteHourly);
    const { data, error } = await supabase.schema("app_api").rpc("backend_register_push_token", {
      actor_uid: auth.uid,
      device_id: requiredText(payload.deviceId, "deviceId", PUSH_TOKEN_LIMITS.deviceId),
      token: requiredText(payload.token, "token", PUSH_TOKEN_LIMITS.token),
      permission: readPermission(payload),
      platform: optionalLimitedText(payload.platform, "platform", PUSH_TOKEN_LIMITS.platform),
      user_agent: optionalLimitedText(payload.userAgent, "userAgent", PUSH_TOKEN_LIMITS.userAgent),
    });
    if (error) throw error;
    return data;
  }

  if (action === "unregisterPushToken") {
    await claimFixedWindowRateLimit(auth.uid, "push-token.write", utcHourWindow(), RATE_LIMITS.pushTokenWriteHourly);
    const { data, error } = await supabase.schema("app_api").rpc("backend_unregister_push_token", {
      actor_uid: auth.uid,
      device_id: requiredText(payload.deviceId, "deviceId", PUSH_TOKEN_LIMITS.deviceId),
      permission: readPermission(payload),
    });
    if (error) throw error;
    return data;
  }

  if (action === "updatePushNotificationPreferences") {
    const preferences = asRecord(payload.preferences);
    const { data, error } = await supabase.schema("app_api").rpc("backend_update_push_notification_preferences", {
      actor_uid: auth.uid,
      comments_enabled: preferences.comments !== false,
      issue_updates_enabled: preferences.issueUpdates !== false,
      device_id: readDeviceId(payload),
      permission: readPermission(payload),
    });
    if (error) throw error;
    return data;
  }

  if (action === "getPushNotificationPreference") {
    const { data, error } = await supabase.schema("app_api").rpc("backend_push_notification_preference", {
      actor_uid: auth.uid,
      device_id: readDeviceId(payload),
      permission: readPermission(payload),
    });
    if (error) throw error;
    return data;
  }

  throw new Error("unsupported-action");
}
