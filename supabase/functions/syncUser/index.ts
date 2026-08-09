import { createDatabaseClient } from "../_shared/database-client.ts";
import { requireEnv } from "../_shared/env.ts";
import { firebaseAuthEmulatorHost, requireEligibleFirebaseUser } from "../_shared/firebase-auth.ts";
import { getGoogleAccessToken } from "../_shared/google-oauth.ts";
import { errorStatus, handleCorsPreflight, jsonResponse, publicErrorBody, requireMethod } from "../_shared/http.ts";
import { requireOriginSecret } from "../_shared/origin.ts";
import { createFunctionLogger } from "../_shared/observability.ts";
import { RATE_LIMITS } from "../_shared/rate-limits.ts";
import { claimFixedWindowRateLimit, utcHourWindow } from "../_shared/upstash-rate-limit.ts";

function parseCustomAttributes(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function adminEmails() {
  const emails = requireEnv("ADMIN_EMAILS")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (emails.length === 0) throw new Error("service-not-configured");
  return [...new Set(emails)];
}

async function setAuthenticatedClaim(
  projectId: string,
  user: Awaited<ReturnType<typeof requireEligibleFirebaseUser>>,
) {
  const emulatorHost = firebaseAuthEmulatorHost();
  let authorization = "Bearer owner";
  let updateUrl = `http://${emulatorHost}/identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/accounts:update`;

  if (!emulatorHost) {
    const accessToken = await getGoogleAccessToken([
      "https://www.googleapis.com/auth/identitytoolkit",
      "https://www.googleapis.com/auth/firebase",
    ]);
    authorization = `Bearer ${accessToken}`;
    updateUrl = `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/accounts:update`;
  }

  const updateResponse = await fetch(updateUrl, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      localId: user.uid,
      customAttributes: JSON.stringify({
        ...parseCustomAttributes(user.customAttributes),
        role: "authenticated",
      }),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!updateResponse.ok) {
    throw new Error(`Firebase custom claim update failed: ${await updateResponse.text()}`);
  }
}

Deno.serve(async (request) => {
  const originFailure = requireOriginSecret(request);
  if (originFailure) return originFailure;
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;

  const methodFailure = requireMethod(request, "POST");
  if (methodFailure) return methodFailure;

  const log = createFunctionLogger("syncUser");
  try {
    const projectId = requireEnv("FIREBASE_PROJECT_ID");
    const user = await requireEligibleFirebaseUser(request);
    await claimFixedWindowRateLimit(user.uid, "auth.sync", utcHourWindow(), RATE_LIMITS.loginSyncHourly);

    await setAuthenticatedClaim(projectId, user);

    const supabase = createDatabaseClient();

    // Resolve email conflicts by setting email to null for any other user profile
    const { error: conflictError } = await supabase.schema("app_private")
      .from("user_profiles")
      .update({ email: null })
      .eq("email", user.email.toLowerCase())
      .neq("uid", user.uid);
    if (conflictError) throw conflictError;

    const { error: profileError } = await supabase.schema("app_private").from("user_profiles").upsert({
      uid: user.uid,
      email: user.email.toLowerCase(),
      display_name: user.name,
      photo_url: user.photoUrl,
      updated_at: new Date().toISOString(),
    }, { onConflict: "uid" });
    if (profileError) throw profileError;
    const { error: adminSyncError } = await supabase.schema("app_api").rpc("backend_reconcile_platform_admins", {
      actor_uid: user.uid,
      admin_emails: adminEmails(),
    });
    if (adminSyncError) throw adminSyncError;

    log.success("user-sync.completed", { status: 200 });
    return jsonResponse({ ok: true, role: "authenticated" });
  } catch (error) {
    const status = errorStatus(error);
    if (status >= 500) log.error("user-sync.failed", error, { status });
    else log.warn("user-sync.rejected", { status });
    return jsonResponse({ ok: false, error: publicErrorBody(error) }, { status });
  }
});
