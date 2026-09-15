import { asRecord, asString } from "../shared/http.ts";
import { createMediaDeliveryUrl } from "../shared/media-delivery.ts";
import { requirePermission } from "./auth.ts";
import type { AuthContext, BackendDatabase, JsonRecord } from "./types.ts";
import type { Selected } from "../database/schema.ts";
import {
  listActiveAccountAccessRules,
  selectAccountAccessRule,
  type AccountAccessPreset,
  type AccountAccessTargetType,
} from "../shared/account-access.ts";

const ACCESS_PRESETS = new Set<AccountAccessPreset>(["read_only", "reaction_only", "blocked"]);
const ACCESS_TARGET_TYPES = new Set<AccountAccessTargetType>(["uid", "email_prefix"]);
const ACCESS_DURATIONS = new Set(["7d", "30d", "custom", "permanent"]);
const EMAIL_PREFIX_PATTERN = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/u;

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
    const rules = await listActiveAccountAccessRules(database);
    return {
      ...withAvatars,
      users: withAvatars.users.map((entry) => {
        const user = asRecord(entry);
        return {
          ...user,
          accessRule: selectAccountAccessRule(rules, {
            email: asString(user.email),
            uid: asString(user.uid),
          }),
        };
      }),
    };
  }

  if (action === "listAccountAccessRules") {
    const { rows } = await database.sql<Selected<
      "user_restrictions",
      "uid" | "target_type" | "preset" | "reason" | "restricted_until" | "restricted_permanently" | "updated_at"
    >>`select uid, target_type, preset, reason, restricted_until, restricted_permanently, updated_at
        from app_private.user_restrictions order by target_type, uid`;
    const rules = await Promise.all(rows.map(async (row) => {
      const matchCount = row.target_type === "email_prefix"
        ? (await database.sqlOne<{ count: number }>`select count(*)::integer count
            from app_private.user_profiles
            where lower(split_part(coalesce(email, ''), '@', 1)) like ${row.uid + "%"}`).count
        : 1;
      return {
        expiresAt: row.restricted_until,
        matchCount,
        message: row.reason ?? "",
        permanent: row.restricted_permanently,
        preset: row.preset,
        targetType: row.target_type,
        targetValue: row.uid,
        updatedAt: row.updated_at,
      };
    }));
    return { rules };
  }

  if (action === "saveAccountAccessRule") {
    const targetType = asString(payload.targetType) as AccountAccessTargetType;
    const preset = asString(payload.preset) as AccountAccessPreset;
    const duration = asString(payload.duration);
    const message = asString(payload.message).trim();
    let targetValue = asString(payload.targetValue).trim();
    if (!ACCESS_TARGET_TYPES.has(targetType) || !ACCESS_PRESETS.has(preset)
      || !ACCESS_DURATIONS.has(duration) || !message) throw new Error("validation-required");
    if (message.length > 500) throw new Error("validation-invalid");
    if (targetType === "email_prefix") {
      targetValue = targetValue.toLowerCase();
      if (targetValue.length > 64 || !EMAIL_PREFIX_PATTERN.test(targetValue)) throw new Error("validation-invalid");
    } else {
      if (!targetValue || targetValue === auth.uid) throw new Error("permission-denied");
      const target = await database.sqlMaybe<Selected<"user_profiles", "uid">>`
        select p.uid from app_private.user_profiles p where p.uid = ${targetValue}
          and not exists(select 1 from app_private.user_role_assignments r
          where r.uid = p.uid and r.role_code = 'platform-admin') for update`;
      if (!target) throw new Error("permission-denied");
    }
    const hours = duration === "custom" ? payload.durationHours : undefined;
    if (duration === "custom" && (!Number.isInteger(hours) || Number(hours) < 1 || Number(hours) > 87_600)) {
      throw new Error("validation-invalid");
    }
    const durationHours = duration === "7d" ? 168 : duration === "30d" ? 720 : Number(hours ?? 0);
    const permanent = duration === "permanent";
    const updated = await database.sqlOne<Selected<"user_restrictions", "restricted_until">>`
      insert into app_private.user_restrictions
        (uid, target_type, preset, restricted_until, restricted_permanently, reason, updated_by)
      values (${targetValue}, ${targetType}, ${preset},
        ${permanent ? null : new Date(Date.now() + durationHours * 3_600_000).toISOString()},
        ${permanent}, ${message}, ${auth.uid})
      on conflict (target_type, uid) do update set preset = excluded.preset,
        restricted_until = excluded.restricted_until,
        restricted_permanently = excluded.restricted_permanently,
        reason = excluded.reason, updated_by = excluded.updated_by, updated_at = now()
      returning restricted_until`;
    return { expiresAt: updated.restricted_until, preset, success: true, targetType, targetValue };
  }

  if (action === "deleteAccountAccessRule") {
    const targetType = asString(payload.targetType) as AccountAccessTargetType;
    const targetValue = asString(payload.targetValue).trim();
    if (!ACCESS_TARGET_TYPES.has(targetType) || !targetValue) throw new Error("validation-required");
    await database.sql`delete from app_private.user_restrictions
      where target_type = ${targetType} and uid = ${targetValue}`;
    return { success: true, targetType, targetValue };
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
