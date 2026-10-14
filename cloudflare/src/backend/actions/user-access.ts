import type { ActionInput } from "../../../../shared/actions.ts";
import { platformAdminEmails } from "../shared/platform-admin.ts";
import type { AuthContext, BackendDatabase } from "./types.ts";
import type { Selected } from "../database/schema.ts";
import { accessUsersForUids } from "./access-user-profiles.ts";

type AccessScopeSelector = { categoryId: string; kind: "announcement" | "facility" | "issue" };

function scopeOf(input: { scopeKind: "announcement" } | { scopeKind: "facility" | "issue"; categoryId: string }): AccessScopeSelector {
  return input.scopeKind === "announcement"
    ? { categoryId: "", kind: "announcement" }
    : { categoryId: input.categoryId, kind: input.scopeKind };
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
  const data = await database.call("app_api", "backend_update_user_access_scope", {
    actor_uid: auth.uid, target_uid: uid, scope_kind: scope.kind,
    category_id: scope.categoryId || null, grant_access: grant,
  });
  return data;
}

export async function listRoleAssignments(input: ActionInput<"listRoleAssignments">, auth: AuthContext, database: BackendDatabase) {
  let revision = "";
  let uids: string[];
  if ("scopeKind" in input) {
    const scoped = await scopedAccessUids(scopeOf(input), database);
    revision = scoped.revision;
    uids = scoped.uids;
  } else {
    const query = input.query.includes("@") ? input.query.toLowerCase() : input.query;
    const { rows } = query.includes("@")
      ? await database.sql<Selected<"user_profiles", "uid">>`
        select uid from app_private.user_profiles where lower(btrim(email)) = ${query} limit 1`
      : await database.sql<Selected<"user_profiles", "uid">>`
        select uid from app_private.user_profiles where uid = ${query} limit 1`;
    uids = rows.map((profile) => profile.uid);
  }
  const lookup = !("scopeKind" in input);
  return (async function* () {
    yield { data: false, key: "truncated" };
    yield { data: revision, key: "revision" };
    yield { data: await accessUsersForUids(uids, database, auth.uid, !lookup), key: "users" };
  })();
}

export async function setUserAccessScope(input: ActionInput<"setUserAccessScope">, auth: AuthContext, database: BackendDatabase) {
  const scope = scopeOf(input);
  await lockScope(scope, database);
  return updateScopeMember(input.uid, scope, input.grant, auth, database);
}

export async function saveScopeMembers(input: ActionInput<"saveScopeMembers">, auth: AuthContext, database: BackendDatabase) {
  const scope = scopeOf(input);
  await lockScope(scope, database);
  const before = await scopedAccessUids(scope, database);
  if (before.revision !== input.revision) throw new Error("configuration-changed");
  const beforeUids = new Set(before.uids);
  const changed = input.changes.filter((change) => beforeUids.has(change.uid) !== change.grant);
  // Overlapping batches in different scopes lock their shared accounts in the
  // same order. The action transaction rolls back every change on any failure.
  await database.sql`select uid from app_private.user_profiles
    where uid = any(${changed.map((change) => change.uid)}) order by uid for update`;
  for (const change of changed) await updateScopeMember(change.uid, scope, change.grant, auth, database);
  const after = await scopedAccessUids(scope, database);
  const users = await accessUsersForUids(after.uids, database, auth.uid);
  return { changedUids: changed.map((change) => change.uid), revision: after.revision, success: true, users };
}
