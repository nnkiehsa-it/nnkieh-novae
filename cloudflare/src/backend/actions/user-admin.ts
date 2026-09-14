import { asRecord, asString } from "../shared/http.ts";
import { createMediaDeliveryUrl } from "../shared/media-delivery.ts";
import { requirePermission } from "./auth.ts";
import type { AuthContext, BackendDatabase, JsonRecord } from "./types.ts";
import type { Selected } from "../database/schema.ts";

const RESTRICTION_MODES = new Set(["clear", "7d", "30d", "permanent", "custom"]);

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
    return await withAdminUserAvatars(data, auth.uid, database);
  }

  if (action === "setUserRestriction") {
    const uid = asString(payload.uid).trim();
    const mode = asString(payload.mode);
    const reason = asString(payload.reason).trim();
    if (!uid || !RESTRICTION_MODES.has(mode)) throw new Error("validation-required");
    if (mode !== "clear" && !reason) throw new Error("validation-required");
    if (mode === 'custom') {
      const hours = payload.durationHours;
      if (!Number.isInteger(hours) || Number(hours) < 1 || Number(hours) > 87600 || reason.length > 500) throw new Error('validation-invalid');
      if (uid === auth.uid) throw new Error('permission-denied');
      const target = await database.sqlMaybe<Selected<'user_profiles', 'uid'>>`
        select p.uid from app_private.user_profiles p where p.uid = ${uid}
          and not exists(select 1 from app_private.user_role_assignments r
          where r.uid = p.uid and r.role_code = 'platform-admin') for update`;
      if (!target) throw new Error('permission-denied');
      const updated = await database.sqlOne<Selected<'user_restrictions', 'restricted_until'>>`
        insert into app_private.user_restrictions
          (uid, restricted_until, restricted_permanently, reason, updated_by)
        values (${uid}, now() + make_interval(hours => ${hours}::integer), false, ${reason}, ${auth.uid})
        on conflict (uid) do update set restricted_until = excluded.restricted_until,
          restricted_permanently = false, reason = excluded.reason,
          updated_by = excluded.updated_by, updated_at = now()
        returning restricted_until`;
      return { success: true, uid, restrictedUntil: updated.restricted_until, restrictedPermanently: false };
    }

    const { data, error } = await database.call("app_api", "backend_set_user_restriction", {
      actor_uid: auth.uid,
      target_uid: uid,
      restriction_mode: mode,
      reason,
    });
    if (error) throw error;
    return data;
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
