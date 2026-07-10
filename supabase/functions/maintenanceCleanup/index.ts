import { createClient } from "npm:@supabase/supabase-js@2";
import type { Database } from "../_shared/database.ts";
import { requireEnv } from "../_shared/env.ts";
import { errorMessage, errorStatus, jsonResponse, publicError, requireMethod } from "../_shared/http.ts";
import { ISSUE_CATEGORY_IDS } from "../_shared/issue-categories.ts";
import { RATE_LIMITS } from "../_shared/rate-limits.ts";
import { claimFixedWindowRateLimits, utcMinuteWindow, utcSecondWindow } from "../_shared/upstash-rate-limit.ts";
import { requireBearerSecret } from "../_shared/webhook.ts";

Deno.serve(async (request) => {
  const methodFailure = requireMethod(request, "POST");
  if (methodFailure) return methodFailure;

  const authFailure = requireBearerSecret(request);
  if (authFailure) return authFailure;

  try {
    await claimFixedWindowRateLimits([
      { identifier: "global", actionName: "worker.maintenance.second", window: utcSecondWindow(), config: RATE_LIMITS.workerRunSecond },
      { identifier: "global", actionName: "worker.maintenance", window: utcMinuteWindow(), config: RATE_LIMITS.workerRunMinute },
    ]);
    const supabase = createClient<Database>(
      requireEnv("SUPABASE_URL"),
      requireEnv("APP_SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false } },
    );
    const { data, error } = await supabase
      .schema("app_api")
      .rpc("run_maintenance_cleanup", { valid_issue_categories: [...ISSUE_CATEGORY_IDS] });
    if (error) throw error;

    const baseUrl = requireEnv("SUPABASE_URL").replace(/\/+$/u, "");
    const authorization = `Bearer ${requireEnv("WEBHOOK_SECRET")}`;
    const workerResults = await Promise.all(["processDeletionJobs", "outboxWorker"].map(async (functionName) => {
      const response = await fetch(`${baseUrl}/functions/v1/${functionName}`, {
        method: "POST",
        headers: { authorization, "content-type": "application/json" },
        body: JSON.stringify({ signal: "daily_maintenance" }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`${functionName}-failed`);
      return await response.json();
    }));

    return jsonResponse({ ok: true, result: data, workers: workerResults });
  } catch (error) {
    console.error(errorMessage(error));
    return jsonResponse({ ok: false, error: publicError(error) }, { status: errorStatus(error) });
  }
});
