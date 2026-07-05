import { asRecord, asString } from "../_shared/http.ts";
import { RATE_LIMITS } from "../_shared/rate-limits.ts";
import { claimFixedWindowRateLimit } from "../_shared/upstash-rate-limit.ts";
import type { AuthContext, BackendSupabase, JsonRecord } from "./types.ts";
import { applyDescendingDateCursor, asNumber, readCursor, toMs, utcHourWindow } from "./utils.ts";

function notificationToResponse(notification: JsonRecord, openedAt: string | null) {
  return {
    ...notification,
    created_at_ms: toMs(notification.created_at),
    is_read: openedAt ? String(notification.created_at) <= openedAt : false,
  };
}

function notificationCursor(notification: JsonRecord) {
  return { id: notification.id, createdAtMs: notification.created_at_ms };
}

async function upsertNotificationState(supabase: BackendSupabase, uid: string) {
  const { data, error } = await supabase
    .schema("app_private")
    .from("notification_states")
    .upsert({ uid }, { onConflict: "uid" })
    .select("*")
    .single();
  if (error) throw error;
  return data as JsonRecord;
}

export function isNotificationAction(action: string) {
  return action === "listNotifications"
    || action === "getNotificationReadState"
    || action === "markNotificationsOpened"
    || action === "getPushNotificationPreference"
    || action === "registerPushToken"
    || action === "unregisterPushToken"
    || action === "updatePushNotificationPreferences";
}

export async function handleNotificationAction(
  action: string,
  payload: JsonRecord,
  auth: AuthContext,
  supabase: BackendSupabase,
) {
  if (action === "listNotifications") {
    const source = asString(payload.source, "broadcast");
    const pageSize = Math.min(Math.max(Math.round(asNumber(payload.pageSize, 10)), 1), 30);
    const state = await upsertNotificationState(supabase, auth.uid);
    const openedAt = source === "admin" ? state.admin_opened_at : source === "user" ? state.user_opened_at : state.broadcast_opened_at;
    let query = supabase.schema("app_private").from("notifications").select("*").eq("source", source);
    if (source === "user") query = query.eq("recipient_uid", auth.uid);
    if (source === "admin" && !auth.isAdmin) return { notifications: [], cursor: null, hasMore: false };
    query = applyDescendingDateCursor(query, readCursor(payload), "created_at");
    query = query.order("created_at", { ascending: false }).order("id", { ascending: false }).limit(pageSize + 1);
    const { data, error } = await query;
    if (error) throw error;
    const notifications = (data ?? []).map((notification) => notificationToResponse(notification as JsonRecord, openedAt as string | null));
    const lastNotification = notifications[Math.min(pageSize - 1, notifications.length - 1)];
    return {
      notifications: notifications.slice(0, pageSize),
      cursor: notifications.length > pageSize && lastNotification ? notificationCursor(lastNotification) : null,
      hasMore: notifications.length > pageSize,
    };
  }

  if (action === "getNotificationReadState") {
    const state = await upsertNotificationState(supabase, auth.uid);
    return { state: {
      ...state,
      admin_opened_at_ms: toMs(state.admin_opened_at),
      broadcast_opened_at_ms: toMs(state.broadcast_opened_at),
      user_opened_at_ms: toMs(state.user_opened_at),
    } };
  }

  if (action === "markNotificationsOpened") {
    const openedAt = new Date().toISOString();
    const { error } = await supabase.schema("app_private").from("notification_states").upsert({
      uid: auth.uid,
      admin_opened_at: openedAt,
      broadcast_opened_at: openedAt,
      user_opened_at: openedAt,
      updated_at: openedAt,
    }, { onConflict: "uid" });
    if (error) throw error;
    return { openedAtMs: Date.parse(openedAt), success: true };
  }

  const state = await upsertNotificationState(supabase, auth.uid);
  if (action === "registerPushToken") {
    await claimFixedWindowRateLimit(auth.uid, "push-token.write", utcHourWindow(), RATE_LIMITS.pushTokenWriteHourly);
    await supabase.schema("app_private").from("push_tokens").upsert({
      uid: auth.uid,
      device_id: asString(payload.deviceId),
      token: asString(payload.token),
      permission: asString(payload.permission, "default"),
      platform: asString(payload.platform),
      user_agent: asString(payload.userAgent),
      updated_at: new Date().toISOString(),
    }, { onConflict: "uid,device_id" });
  }
  if (action === "unregisterPushToken") {
    await claimFixedWindowRateLimit(auth.uid, "push-token.write", utcHourWindow(), RATE_LIMITS.pushTokenWriteHourly);
    const deviceId = asString(payload.deviceId);
    if (deviceId) await supabase.schema("app_private").from("push_tokens").delete().eq("uid", auth.uid).eq("device_id", deviceId);
  }
  if (action === "updatePushNotificationPreferences") {
    const preferences = asRecord(payload.preferences);
    const comments = preferences.comments !== false;
    const issueUpdates = preferences.issueUpdates !== false;
    await supabase.schema("app_private").from("notification_states").update({
      push_comments_enabled: comments,
      push_issue_updates_enabled: issueUpdates,
      updated_at: new Date().toISOString(),
    }).eq("uid", auth.uid);
    state.push_comments_enabled = comments;
    state.push_issue_updates_enabled = issueUpdates;
  }
  const { count } = await supabase.schema("app_private").from("push_tokens").select("*", { count: "exact", head: true }).eq("uid", auth.uid);
  return {
    deviceEnabled: Boolean(asString(payload.deviceId)),
    enabled: (count ?? 0) > 0,
    personalPreferences: {
      comments: state.push_comments_enabled !== false,
      issueUpdates: state.push_issue_updates_enabled !== false,
    },
    permission: asString(payload.permission, "default"),
    tokenCount: count ?? 0,
  };
}
