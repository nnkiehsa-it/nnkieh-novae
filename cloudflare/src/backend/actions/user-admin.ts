import { asRecord, asString } from "../shared/json.ts";
import { createMediaDeliveryUrl } from "../shared/media-delivery.ts";
import { platformAdminEmails } from "../shared/platform-admin.ts";
import type { ActionInput } from "../../../../shared/actions.ts";
import type { AuthContext, BackendDatabase } from "./types.ts";
import type { Selected } from "../database/schema.ts";
import {
  selectAccountAccessRule,
} from "../shared/account-access.ts";
import { loadAccountAccessRules } from "./account-access-rules.ts";


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
    "user_profiles", "uid" | "avatar_public_id"
  >>`select uid, avatar_public_id from app_private.user_profiles where uid = any(${uids})`;
  const profiles = new Map(rows.map((profile) => [profile.uid, profile]));
  return {
    ...result,
    users: await Promise.all(users.map(async (user) => {
      const uid = asString(user.uid);
      const profile = profiles.get(uid);
      const media = profile?.avatar_public_id
        ? await createMediaDeliveryUrl(profile.avatar_public_id, "avatar", false, viewerUid)
        : null;
      return { ...user, photoUrl: media?.url ?? null };
    })),
  };
}

const WINDOW_HOURS = { "24h": 24, "7d": 168, "30d": 720 } as const;

export async function listAdminActivity(input: ActionInput<"listAdminActivity">, _auth: AuthContext, database: BackendDatabase) {
  return await database.call("app_api", "backend_list_admin_activity", {
    before_key: input.cursor?.key ?? null,
    before_occurred_at: input.cursor?.occurredAt ?? null,
    page_limit: 100,
    window_hours: WINDOW_HOURS[input.window],
  });
}

export async function getAdminOverview(input: ActionInput<"getAdminOverview">, _auth: AuthContext, database: BackendDatabase) {
  return await database.call("app_api", "get_admin_overview", { window_hours: WINDOW_HOURS[input.window] });
}

export async function listAdminUsers(input: ActionInput<"listAdminUsers">, auth: AuthContext, database: BackendDatabase) {
  const data = await database.call("app_api", "backend_list_admin_users", {
    search_query: input.query,
    page_limit: 80,
    page_offset: input.page * 80,
  });
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

export async function listAdminAudit(input: ActionInput<"listAdminAudit">, _auth: AuthContext, database: BackendDatabase) {
  return await database.call("app_api", "backend_list_admin_audit", {
    search_query: input.query,
    page_limit: 100,
    page_offset: input.page * 100,
  });
}
