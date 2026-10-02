import { asString } from "../shared/http.ts";
import { platformAdminEmails } from "../shared/platform-admin.ts";
import type { AuthContext, BackendDatabase, JsonRecord } from "./types.ts";
import { requirePermission } from "./auth.ts";
import type { Selected } from "../database/schema.ts";
import { accessUsersForUids } from "./access-user-profiles.ts";

const ACCESS_SCOPE_KINDS = new Set(["announcement", "facility", "issue"]);

interface AccessScopeSelector {
  categoryId: string;
  kind: "announcement" | "facility" | "issue";
}

function readAccessScope(payload: JsonRecord): AccessScopeSelector | null {
  const scopeKind = asString(payload.scopeKind);
  if (!scopeKind) return null;
  if (!ACCESS_SCOPE_KINDS.has(scopeKind)) throw new Error("validation-required");
  const categoryId = asString(payload.categoryId).trim();
  if ((scopeKind === "issue" || scopeKind === "facility") && !categoryId) {
    throw new Error("validation-required");
  }
  if (scopeKind === "announcement" && categoryId) throw new Error("validation-invalid");
  return { categoryId, kind: scopeKind as AccessScopeSelector["kind"] };
}

async function scopedAccessUids(scope: AccessScopeSelector, database: BackendDatabase) {
  type Membership = { scope_valid: boolean; revision: string; uids: string[] };
  const membership = scope.kind === "announcement"
    ? await database.sqlOne<Membership>`
      select true as scope_valid, coalesce(array_agg(uid order by uid), array[]::text[]) as uids,
        md5(coalesce(jsonb_agg(uid order by uid), '[]'::jsonb)::text) as revision
      from app_private.user_role_assignments where role_code = 'announcement-manager'`
    : scope.kind === "issue"
    ? await database.sqlOne<Membership>`
      select exists(select 1 from app_private.issue_categories where id = ${scope.categoryId} and is_active) as scope_valid,
        coalesce(array_agg(uid order by uid), array[]::text[]) as uids,
        md5(coalesce(jsonb_agg(uid order by uid), '[]'::jsonb)::text) as revision
      from app_private.user_issue_category_assignments where category_id = ${scope.categoryId}`
    : await database.sqlOne<Membership>`
      select exists(select 1 from app_private.facility_categories where id = ${scope.categoryId} and is_active) as scope_valid,
        coalesce(array_agg(uid order by uid), array[]::text[]) as uids,
        md5(coalesce(jsonb_agg(uid order by uid), '[]'::jsonb)::text) as revision
      from app_private.user_facility_category_assignments where category_id = ${scope.categoryId}`;
  if (!membership.scope_valid) throw new Error(scope.kind === "issue" ? "invalid-issue-category" : "invalid-facility-category");
  return { revision: membership.revision, uids: membership.uids };
}

async function lockScope(scope: AccessScopeSelector, database: BackendDatabase) {
  await database.sql`select pg_advisory_xact_lock(hashtext(${`novae:access:${scope.kind}:${scope.categoryId}`}))`;
}

async function updateScopeMember(uid: string, scope: AccessScopeSelector, grant: boolean, auth: AuthContext, database: BackendDatabase) {
  const target = await database.sqlOne<{ configured_admin: boolean }>`
    select app_api.backend_reconcile_scope_target_admin(${auth.uid}, ${uid}, ${platformAdminEmails()}) as configured_admin`;
  if (target.configured_admin) throw new Error("permission-denied");
  const { data, error } = await database.call("app_api", "backend_update_user_access_scope", {
    actor_uid: auth.uid, target_uid: uid, scope_kind: scope.kind,
    category_id: scope.categoryId || null, grant_access: grant,
  });
  if (error) throw error;
  return data;
}

export async function handleUserAccessAction(
  action: string,
  payload: JsonRecord,
  auth: AuthContext,
  database: BackendDatabase,
) {
  requirePermission(auth, "role.manage");
  if (action === "listRoleAssignments") {
    const rawQuery = asString(payload.query).trim();
    const scope = readAccessScope(payload);
    if (!rawQuery && !scope) throw new Error("validation-required");
    let revision = "";
    let uids: string[] = [];
    if (rawQuery) {
      const query = rawQuery.includes("@") ? rawQuery.toLowerCase() : rawQuery;
      const { rows } = query.includes("@")
        ? await database.sql<Selected<"user_profiles", "uid">>`
          select uid from app_private.user_profiles where lower(btrim(email)) = ${query} limit 1`
        : await database.sql<Selected<"user_profiles", "uid">>`
          select uid from app_private.user_profiles where uid = ${query} limit 1`;
      uids = rows.map((profile) => profile.uid);
    } else if (scope) {
      const scoped = await scopedAccessUids(scope, database);
      revision = scoped.revision;
      uids = scoped.uids;
    }
    return (async function* () {
      yield { data: false, key: "truncated" };
      yield { data: revision, key: "revision" };
      yield { data: await accessUsersForUids(uids, database, auth.uid, !rawQuery), key: "users" };
    })();
  }

  if (action === "setUserAccessScope") {
    const uid = asString(payload.uid).trim();
    const scope = readAccessScope(payload);
    if (!uid || !scope || typeof payload.grant !== "boolean") {
      throw new Error("validation-required");
    }
    await lockScope(scope, database);
    return updateScopeMember(uid, scope, payload.grant, auth, database);
  }

  if (action === "saveScopeMembers") {
    const scope = readAccessScope(payload);
    if (!scope || typeof payload.revision !== "string" || !/^[a-f0-9]{32}$/u.test(payload.revision)
      || !Array.isArray(payload.changes) || payload.changes.length === 0) throw new Error("validation-required");
    const changes = payload.changes.map((value) => {
      const change = value as { uid?: unknown; grant?: unknown } | null;
      if (!change || typeof change.uid !== "string" || !change.uid.trim() || typeof change.grant !== "boolean") throw new Error("validation-required");
      return { uid: change.uid.trim(), grant: change.grant };
    });
    if (new Set(changes.map((change) => change.uid)).size !== changes.length) throw new Error("validation-required");
    await lockScope(scope, database);
    const before = await scopedAccessUids(scope, database);
    if (before.revision !== payload.revision) throw new Error("configuration-changed");
    const beforeUids = new Set(before.uids);
    const changed = changes.filter((change) => beforeUids.has(change.uid) !== change.grant);
    // Overlapping batches in different scopes lock their shared accounts in the
    // same order. The action transaction rolls back every change on any failure.
    await database.sql`select uid from app_private.user_profiles
      where uid = any(${changed.map((change) => change.uid)}) order by uid for update`;
    for (const change of changed) await updateScopeMember(change.uid, scope, change.grant, auth, database);
    const after = await scopedAccessUids(scope, database);
    const users = await accessUsersForUids(after.uids, database, auth.uid);
    return { changedUids: changed.map((change) => change.uid), revision: after.revision, success: true, users };
  }

  throw new Error("invalid-action");
}
