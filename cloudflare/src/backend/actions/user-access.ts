import { asString } from "../shared/http.ts";
import { createMediaDeliveryUrl } from "../shared/media-delivery.ts";
import type { AuthContext, BackendDatabase, JsonRecord } from "./types.ts";
import { requirePermission } from "./auth.ts";
import type { Selected } from "../database/schema.ts";
import { settledSegments } from "./segments.ts";

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
  const { data, error } = await database.call("app_api", "backend_update_user_access_scope", {
    actor_uid: auth.uid, target_uid: uid, scope_kind: scope.kind,
    category_id: scope.categoryId || null, grant_access: grant,
  });
  if (error) throw error;
  return data;
}

async function* accessUsersForUids(
  uids: string[],
  database: BackendDatabase,
  viewerUid: string,
  excludePlatformAdmins = true,
) {
  if (uids.length === 0) {
    yield { data: [], key: "users" };
    return;
  }
  const profiles = database.sql<Selected<"user_profiles", "uid" | "email" | "display_name" | "avatar_public_id" | "photo_url">>`
      select uid, email, display_name, avatar_public_id, photo_url from app_private.user_profiles
      where uid = any(${uids}) order by display_name`
    .then(({ rows }) => Promise.all(rows.map(async (profile) => {
      const media = profile.avatar_public_id
        ? await createMediaDeliveryUrl(profile.avatar_public_id, "avatar", false, viewerUid)
        : null;
      return { ...profile, resolvedPhotoUrl: media?.url ?? profile.photo_url ?? null };
    })));
  const roleAssignments = database.sql<Selected<"user_role_assignments", "uid" | "role_code">>`
    select uid, role_code from app_private.user_role_assignments where uid = any(${uids})`
    .then(({ rows }) => rows);
  const issueAssignments = database.sql<Selected<"user_issue_category_assignments", "uid" | "category_id">>`
    select uid, category_id from app_private.user_issue_category_assignments where uid = any(${uids})`
    .then(({ rows }) => rows);
  const facilityAssignments = database.sql<Selected<"user_facility_category_assignments", "uid" | "category_id">>`
    select uid, category_id from app_private.user_facility_category_assignments where uid = any(${uids})`
    .then(({ rows }) => rows);

  let profileRows: Awaited<typeof profiles> | undefined;
  let roleRows: Awaited<typeof roleAssignments> | undefined;
  let issueRows: Awaited<typeof issueAssignments> = [];
  let facilityRows: Awaited<typeof facilityAssignments> = [];
  for await (const segment of settledSegments({ profiles, roleAssignments, issueAssignments, facilityAssignments })) {
    if (segment.key === "profiles") profileRows = segment.data as Awaited<typeof profiles>;
    if (segment.key === "roleAssignments") roleRows = segment.data as Awaited<typeof roleAssignments>;
    if (segment.key === "issueAssignments") issueRows = segment.data as Awaited<typeof issueAssignments>;
    if (segment.key === "facilityAssignments") facilityRows = segment.data as Awaited<typeof facilityAssignments>;
    if (!profileRows || !roleRows) continue;

    const roles = new Map<string, string[]>();
    const issueCategories = new Map<string, string[]>();
    const facilityCategories = new Map<string, string[]>();
    for (const assignment of roleRows) {
      roles.set(assignment.uid, [...(roles.get(assignment.uid) ?? []), assignment.role_code]);
    }
    for (const assignment of issueRows) {
      issueCategories.set(assignment.uid, [...(issueCategories.get(assignment.uid) ?? []), assignment.category_id]);
    }
    for (const assignment of facilityRows) {
      facilityCategories.set(assignment.uid, [...(facilityCategories.get(assignment.uid) ?? []), assignment.category_id]);
    }
    yield { data: profileRows
      .filter((profile) => !excludePlatformAdmins || !(roles.get(profile.uid) ?? []).includes("platform-admin"))
      .map((profile) => ({
      uid: profile.uid,
      email: profile.email ?? null,
      name: profile.display_name ?? profile.email ?? profile.uid,
      photoUrl: profile.resolvedPhotoUrl,
      roles: roles.get(profile.uid) ?? [],
      managedIssueCategoryIds: issueCategories.get(profile.uid) ?? [],
      managedFacilityCategoryIds: facilityCategories.get(profile.uid) ?? [],
      })), key: "users" };
  }
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
          select uid from app_private.user_profiles where email = ${query} limit 1`
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
      yield* accessUsersForUids(uids, database, auth.uid, !rawQuery);
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
    let users: unknown[] = [];
    for await (const segment of accessUsersForUids(after.uids, database, auth.uid)) {
      if (segment.key === "users") users = segment.data as unknown[];
    }
    return { changedUids: changed.map((change) => change.uid), revision: after.revision, success: true, users };
  }

  throw new Error("invalid-action");
}
