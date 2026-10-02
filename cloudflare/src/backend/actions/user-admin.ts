import { asRecord, asString } from "../shared/http.ts";
import { createMediaDeliveryUrl } from "../shared/media-delivery.ts";
import { platformAdminEmails } from "../shared/platform-admin.ts";
import { requirePermission } from "./auth.ts";
import type { AuthContext, BackendDatabase, JsonRecord } from "./types.ts";
import type { Selected } from "../database/schema.ts";
import {
  selectAccountAccessRule,
} from "../shared/account-access.ts";
import { handleAccountAccessRuleAction, loadAccountAccessRules } from "./account-access-rules.ts";


async function withAdminUserAvatars(
  data: unknown,
  viewerUid: string,
  database: BackendDatabase,
) {
  const result = asRecord(data);
  const users = Array.isArray(result.users) ? result.users.map(asRecord) : [];
  const uids = users.map((user) => asString(user.uid)).filter(Boolean);
  if (uids.length === 0) return { ...result, users };
  const { rows } = await database.sql<Selected<
    "user_profiles", "uid" | "avatar_public_id" | "photo_url"
  >>`select uid, avatar_public_id, photo_url from app_private.user_profiles where uid = any(${uids})`;
  const profiles = new Map(rows.map((profile) => [profile.uid, profile]));
  return {
    ...result,
    users: await Promise.all(users.map(async (user) => {
      const uid = asString(user.uid);
      const profile = profiles.get(uid);
      const media = profile?.avatar_public_id
        ? await createMediaDeliveryUrl(profile.avatar_public_id, "avatar", false, viewerUid)
        : null;
      return { ...user, photoUrl: media?.url ?? profile?.photo_url ?? null };
    })),
  };
}

export async function handleUserAdminAction(
  action: string,
  payload: JsonRecord,
  auth: AuthContext,
  database: BackendDatabase,
) {
  if (action === "listAdminActivity") {
    requirePermission(auth, "dashboard.view");
    const window = asString(payload.window, "24h");
    const hours = window === "7d" ? 168 : window === "30d" ? 720 : 24;
    const cursor = asRecord(payload.cursor);
    const { data, error } = await database.call("app_api", "backend_list_admin_activity", {
      before_key: asString(cursor.key) || null,
      before_occurred_at: asString(cursor.occurredAt) || null,
      page_limit: 100,
      window_hours: hours,
    });
    if (error) throw error;
    return asRecord(data);
  }

  if (action === "getAdminOverview") {
    requirePermission(auth, "dashboard.view");
    const window = asString(payload.window, "24h");
    const hours = window === "7d" ? 168 : window === "30d" ? 720 : 24;
    const { data, error } = await database.call("app_api", "get_admin_overview", {
      window_hours: hours,
    });
    if (error) throw error;
    return asRecord(data);
  }

  requirePermission(auth, "role.manage");
  const page = payload.page ?? 0;
  if (!Number.isInteger(page) || Number(page) < 0 || Number(page) > 1_000_000) throw new Error('validation-invalid');

  if (action === "listAdminUsers") {
    const query = asString(payload.query).trim().slice(0, 120);
    const { data, error } = await database.call("app_api", "backend_list_admin_users", {
      search_query: query,
      page_limit: 80,
      page_offset: Number(page) * 80,
    });
    if (error) throw error;
    const withAvatars = await withAdminUserAvatars(data, auth.uid, database);
    const administratorEmails = new Set(platformAdminEmails());
    const rules = await loadAccountAccessRules(database, { userUids: withAvatars.users.map((user) => asString(asRecord(user).uid)) });
    return {
      ...withAvatars,
      users: withAvatars.users.map((entry) => {
        const user = asRecord(entry);
        const administrator = administratorEmails.has(asString(user.email).trim().toLowerCase());
        const assigned = Array.isArray(user.roles) ? user.roles.filter((role) => role !== "platform-admin") : [];
        return {
          ...user,
          roles: administrator ? [...assigned, "platform-admin"] : assigned,
          accessRuleRevision: rules.find((rule) => rule.targetType === "uid" && rule.targetValue === user.uid)?.revision ?? null,
          accessRule: administrator ? null : selectAccountAccessRule(rules.filter((rule) => rule.active), {
            email: asString(user.email),
            uid: asString(user.uid),
          }),
        };
      }),
    };
  }

  if (action === "listAccountAccessRules") {
    return handleAccountAccessRuleAction(action, payload, auth, database);
  }
  if (action === "saveAccountAccessRule" || action === "deleteAccountAccessRule" || action === "previewAccountAccessRule") {
    return handleAccountAccessRuleAction(action, payload, auth, database);
  }

  if (action === "listAdminAudit") {
    const query = asString(payload.query).trim().slice(0, 120);
    const { data, error } = await database.call("app_api", "backend_list_admin_audit", {
      search_query: query,
      page_limit: 100,
      page_offset: Number(page) * 100,
    });
    if (error) throw error;
    return data;
  }

  throw new Error("invalid-action");
}
