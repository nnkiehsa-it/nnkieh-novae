import { requireEnv } from "../_shared/env.ts";
import { requireEligibleFirebaseUser } from "../_shared/firebase-auth.ts";
import type { AuthContext, BackendSupabase } from "./types.ts";

function isAdminEmail(email: string) {
  const adminEmails = (Deno.env.get("ADMIN_EMAILS") ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(email.toLowerCase());
}

export async function requireAuth(supabase: BackendSupabase, request: Request): Promise<AuthContext> {
  const firebaseUser = await requireEligibleFirebaseUser(request);

  const { data: role, error } = await supabase
    .schema("app_private")
    .from("user_roles")
    .select("role")
    .eq("uid", firebaseUser.uid)
    .maybeSingle();
  if (error) throw error;

  return {
    email: firebaseUser.email,
    isAdmin: role?.role === "admin" || isAdminEmail(firebaseUser.email),
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

  return { ok: true };
}
