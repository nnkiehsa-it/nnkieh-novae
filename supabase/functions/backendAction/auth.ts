import { requireEnv } from "../_shared/env.ts";
import { requireVerifiedFirebaseUser } from "../_shared/firebase-auth.ts";
import { getIssueCategoryIdsByReadAccess } from "../_shared/issue-categories.ts";
import type { AuthContext, BackendSupabase } from "./types.ts";

function isAdminEmail(email: string) {
  const adminEmails = (Deno.env.get("ADMIN_EMAILS") ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(email.toLowerCase());
}

export async function requireAuth(supabase: BackendSupabase, request: Request): Promise<AuthContext> {
  const firebaseUser = await requireVerifiedFirebaseUser(request);

  const { data: role, error } = await supabase
    .schema("app_private")
    .from("user_roles")
    .select("role")
    .eq("uid", firebaseUser.uid)
    .maybeSingle();
  if (error) throw error;

  const isAdminFromEmail = isAdminEmail(firebaseUser.email);
  const authoritativeRole = isAdminFromEmail ? "admin" : "user";
  if (role?.role !== authoritativeRole) {
    const { error: upsertError } = await supabase
      .schema("app_private")
      .from("user_roles")
      .upsert({ role: authoritativeRole, uid: firebaseUser.uid, updated_at: new Date().toISOString() }, { onConflict: "uid" });
    if (upsertError) throw upsertError;
  }

  return {
    email: firebaseUser.email,
    isAdmin: isAdminFromEmail,
    name: firebaseUser.name,
    photoUrl: firebaseUser.photoUrl,
    uid: firebaseUser.uid,
  };
}

export function requireAdmin(auth: AuthContext) {
  if (!auth.isAdmin) throw new Error("permission-denied");
}

export async function handleHealthcheck(request: Request, supabase: BackendSupabase) {
  const expected = requireEnv("WEBHOOK_SECRET");
  if (request.headers.get("x-healthcheck-secret") !== expected) {
    throw new Error("permission-denied");
  }

  requireEnv("APP_SUPABASE_SERVICE_ROLE_KEY");
  requireEnv("FIREBASE_WEB_API_KEY");
  requireEnv("ALLOWED_DOMAIN");
  requireEnv("ADMIN_EMAILS");
  requireEnv("UPSTASH_REDIS_REST_URL");
  requireEnv("UPSTASH_REDIS_REST_TOKEN");

  const { error } = await supabase
    .schema("app_private")
    .from("user_roles")
    .select("uid")
    .limit(1);
  if (error) throw error;

  const supabaseUrl = requireEnv("SUPABASE_URL").replace(/\/+$/u, "");
  const { error: settingsError } = await supabase
    .schema("app_private")
    .from("runtime_settings")
    .upsert([
      {
        key: "deletion_worker_url",
        value: `${supabaseUrl}/functions/v1/processDeletionJobs`,
        updated_at: new Date().toISOString(),
      },
      {
        key: "firebase_project_id",
        value: requireEnv("FIREBASE_PROJECT_ID"),
        updated_at: new Date().toISOString(),
      },
      {
        key: "owner_admin_issue_categories",
        value: getIssueCategoryIdsByReadAccess("owner-admin").join(","),
        updated_at: new Date().toISOString(),
      },
      {
        key: "reviewed_school_issue_categories",
        value: getIssueCategoryIdsByReadAccess("reviewed-school").join(","),
        updated_at: new Date().toISOString(),
      },
      {
        key: "maintenance_worker_url",
        value: `${supabaseUrl}/functions/v1/maintenanceCleanup`,
        updated_at: new Date().toISOString(),
      },
      {
        key: "outbox_worker_url",
        value: `${supabaseUrl}/functions/v1/outboxWorker`,
        updated_at: new Date().toISOString(),
      },
      { key: "webhook_secret", value: expected, updated_at: new Date().toISOString() },
    ], { onConflict: "key" });
  if (settingsError) throw settingsError;

  return { ok: true };
}
