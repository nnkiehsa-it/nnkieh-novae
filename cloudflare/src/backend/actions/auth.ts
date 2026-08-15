import { requireEnv } from "../shared/env.ts";
import { requireVerifiedFirebaseUser } from "../shared/firebase-auth.ts";
import type { AuthContext, BackendDatabase, PermissionCode } from "./types.ts";

interface AuthIdentity {
  email: string;
  name: string;
  photoUrl: string | null;
  uid: string;
}

export async function resolveAuthContext(
  database: BackendDatabase,
  firebaseUser: AuthIdentity,
): Promise<AuthContext> {
  const { data, error } = await database.call("app_api", "backend_get_access_context", { actor_uid: firebaseUser.uid });
  if (error) throw error;
  const access = data && typeof data === "object" && !Array.isArray(data)
    ? data as Record<string, unknown>
    : {};
  const roles = Array.isArray(access.roles)
    ? access.roles.filter((role): role is string => typeof role === "string")
    : [];
  const isPlatformAdmin = roles.includes("platform-admin");
  const managedIssueCategoryIds = isPlatformAdmin
    ? []
    : Array.isArray(access.managedIssueCategoryIds)
    ? [...new Set(access.managedIssueCategoryIds.filter((id): id is string => typeof id === "string"))]
    : [];
  const managedFacilityCategoryIds = isPlatformAdmin
    ? []
    : Array.isArray(access.managedFacilityCategoryIds)
    ? [...new Set(access.managedFacilityCategoryIds.filter((id): id is string => typeof id === "string"))]
    : [];
  const permissions = Array.isArray(access.permissions)
    ? [...new Set(access.permissions.filter((permission): permission is PermissionCode =>
      typeof permission === "string"
      && ["announcement.manage", "category.manage", "dashboard.view", "facility.manage", "proposal.manage", "role.manage"].includes(permission)
    ))]
    : [];
  if (managedIssueCategoryIds.length > 0 && !permissions.includes("proposal.manage")) {
    permissions.push("proposal.manage");
  }

  return {
    email: firebaseUser.email,
    isAdmin: isPlatformAdmin,
    managedFacilityCategoryIds,
    managedIssueCategoryIds,
    name: firebaseUser.name,
    photoUrl: firebaseUser.photoUrl,
    permissions,
    roles,
    setupCompleted: access.setupCompleted === true,
    uid: firebaseUser.uid,
  };
}

export async function requireAuth(database: BackendDatabase, request: Request): Promise<AuthContext> {
  return await resolveAuthContext(database, await requireVerifiedFirebaseUser(request));
}

export function canManageIssueCategory(auth: AuthContext, categoryId: string) {
  return auth.isAdmin || auth.managedIssueCategoryIds.includes(categoryId);
}

export function requireIssueCategoryPermission(auth: AuthContext, categoryId: string) {
  if (!canManageIssueCategory(auth, categoryId)) throw new Error("permission-denied");
}

export function canManageFacilityCategory(auth: AuthContext, categoryId: string) {
  return auth.isAdmin || auth.managedFacilityCategoryIds.includes(categoryId);
}

export function requireFacilityCategoryPermission(auth: AuthContext, categoryId: string) {
  if (!canManageFacilityCategory(auth, categoryId)) throw new Error("permission-denied");
}

export function hasPermission(auth: AuthContext, permission: PermissionCode) {
  return auth.permissions.includes(permission);
}

export function requirePermission(auth: AuthContext, permission: PermissionCode) {
  if (!hasPermission(auth, permission)) throw new Error("permission-denied");
}

export async function handleHealthcheck(request: Request, database: BackendDatabase) {
  const expected = requireEnv("HEALTHCHECK_SECRET");
  if (request.headers.get("x-healthcheck-secret") !== expected) {
    throw new Error("permission-denied");
  }

  requireEnv("FIREBASE_WEB_API_KEY");
  requireEnv("FIREBASE_PROJECT_ID");
  requireEnv("ALLOWED_DOMAIN");
  requireEnv("ADMIN_EMAILS");
  requireEnv("PUBLIC_API_URL");
  requireEnv("MEDIA_SIGNING_SECRET");

  const { error } = await database
    .table("app_private", "roles")
    .select("code")
    .limit(1);
  if (error) throw error;
  return { ok: true };
}
