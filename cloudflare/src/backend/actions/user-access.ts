import { asString } from "../shared/http.ts";
import { createMediaDeliveryUrl } from "../shared/media-delivery.ts";
import type { AuthContext, BackendDatabase, JsonRecord } from "./types.ts";
import { requirePermission } from "./auth.ts";
import type { Selected } from "../database/schema.ts";
import { settledSegments } from "./segments.ts";

const ACCESS_LIST_LIMIT = 100;
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
  return { categoryId, kind: scopeKind as AccessScopeSelector["kind"] };
}

async function scopedAccessUids(scope: AccessScopeSelector, database: BackendDatabase) {
  const limit = ACCESS_LIST_LIMIT + 1;
  const { rows } = scope.kind === "announcement"
    ? await database.sql<Selected<"user_role_assignments", "uid">>`
      select uid from app_private.user_role_assignments
      where role_code = 'announcement-manager' limit ${limit}`
    : scope.kind === "issue"
    ? await database.sql<Selected<"user_issue_category_assignments", "uid">>`
      select uid from app_private.user_issue_category_assignments
      where category_id = ${scope.categoryId} limit ${limit}`
    : await database.sql<Selected<"user_facility_category_assignments", "uid">>`
      select uid from app_private.user_facility_category_assignments
      where category_id = ${scope.categoryId} limit ${limit}`;
  const uids = [...new Set(rows.map((row) => row.uid))];
  return { truncated: uids.length > ACCESS_LIST_LIMIT, uids: uids.slice(0, ACCESS_LIST_LIMIT) };
}

async function* accessUsersForUids(
  uids: string[],
  database: BackendDatabase,
  viewerUid: string,
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
      .filter((profile) => !(roles.get(profile.uid) ?? []).includes("platform-admin"))
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
    let truncated = false;
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
      truncated = scoped.truncated;
      uids = scoped.uids;
    }
    return (async function* () {
      yield { data: truncated, key: "truncated" };
      yield* accessUsersForUids(uids, database, auth.uid);
    })();
  }

  if (action === "setUserAccessScope") {
    const uid = asString(payload.uid).trim();
    const scope = readAccessScope(payload);
    if (!uid || !scope || typeof payload.grant !== "boolean") {
      throw new Error("validation-required");
    }
    const { data, error } = await database.call("app_api", "backend_update_user_access_scope", {
      actor_uid: auth.uid,
      target_uid: uid,
      scope_kind: scope.kind,
      category_id: scope.categoryId || null,
      grant_access: payload.grant,
    });
    if (error) throw error;
    return data;
  }

  throw new Error("invalid-action");
}
