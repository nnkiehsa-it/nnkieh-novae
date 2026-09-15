import type { AppDatabaseClient } from "./database/client.ts";
import { requireEnv } from "./shared/env.ts";
import type { FirebaseAuthContext } from "./shared/firebase-auth.ts";
import { errorStatus, publicErrorBody } from "./shared/http.ts";
import { createFunctionLogger } from "./shared/observability.ts";
import { RATE_LIMITS } from "./shared/rate-limits.ts";
import { claimFixedWindowRateLimit, utcHourWindow } from "./shared/business-rate-limit.ts";
import { operationPolicy } from "./shared/operation-policies.ts";
import { AccountAccessError, resolveAccountAccessRule } from "./shared/account-access.ts";

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
    await claimFixedWindowRateLimit(user.uid, "auth.sync", utcHourWindow(), { ...RATE_LIMITS.loginSyncHourly, limit: operationPolicy('loginSyncHourly') });

    const email = user.email.toLowerCase();
    if (!adminEmails().includes(email)) {
      const accessRule = await resolveAccountAccessRule(database, { email, uid: user.uid });
      if (accessRule?.preset === "blocked") throw new AccountAccessError(accessRule.message);
    }
    await database.sql`update app_private.user_profiles set email = null
      where email = ${email} and uid <> ${user.uid}`;

    await database.sql`
      insert into app_private.user_profiles (uid, email, display_name, photo_url, updated_at)
      values (${user.uid}, ${email}, ${user.name}, ${user.photoUrl}, ${new Date().toISOString()})
      on conflict (uid) do update set
        email = excluded.email,
        display_name = excluded.display_name,
        photo_url = excluded.photo_url,
        updated_at = excluded.updated_at`;
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
