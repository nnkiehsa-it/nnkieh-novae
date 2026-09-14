import type { AppDatabaseClient } from "./database/client.ts";
import { requireEnv } from "./shared/env.ts";
import type { FirebaseAuthContext } from "./shared/firebase-auth.ts";
import { errorStatus, publicErrorBody } from "./shared/http.ts";
import { createFunctionLogger } from "./shared/observability.ts";
import { RATE_LIMITS } from "./shared/rate-limits.ts";
import { claimFixedWindowRateLimit, utcHourWindow } from "./shared/business-rate-limit.ts";
import { loadOperationPolicies } from "./shared/operation-policies.ts";

function adminEmails() {
  const emails = requireEnv("ADMIN_EMAILS")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (emails.length === 0) throw new Error("service-not-configured");
  return [...new Set(emails)];
}

export async function handleSyncUser(user: FirebaseAuthContext, database: AppDatabaseClient) {
  const log = createFunctionLogger("syncUser");
  try {
    const { values } = await loadOperationPolicies(database);
    await claimFixedWindowRateLimit(user.uid, "auth.sync", utcHourWindow(), { ...RATE_LIMITS.loginSyncHourly, limit: values.loginSyncHourly });

    const { error: conflictError } = await database.table("app_private", "user_profiles")
      .update({ email: null })
      .eq("email", user.email.toLowerCase())
      .neq("uid", user.uid);
    if (conflictError) throw conflictError;

    const { error: profileError } = await database.table("app_private", "user_profiles").upsert({
      uid: user.uid,
      email: user.email.toLowerCase(),
      display_name: user.name,
      photo_url: user.photoUrl,
      updated_at: new Date().toISOString(),
    }, { onConflict: "uid" });
    if (profileError) throw profileError;
    const { error: adminSyncError } = await database.call("app_api", "backend_reconcile_platform_admins", {
      actor_uid: user.uid,
      admin_emails: adminEmails(),
    });
    if (adminSyncError) throw adminSyncError;

    log.success("user-sync.completed", { status: 200 });
    return Response.json({ ok: true });
  } catch (error) {
    const status = errorStatus(error);
    if (status >= 500) log.error("user-sync.failed", error, { status });
    else log.warn("user-sync.rejected", { status });
    return Response.json({ ok: false, error: publicErrorBody(error) }, { status });
  }
}
