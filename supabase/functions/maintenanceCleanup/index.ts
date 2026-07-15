import { createClient } from "npm:@supabase/supabase-js@2";
import type { Database } from "../_shared/database.ts";
import { requireEnv } from "../_shared/env.ts";
import { errorMessage, errorStatus, jsonResponse, publicError, requireMethod } from "../_shared/http.ts";
import { ISSUE_CATEGORY_IDS } from "../_shared/issue-categories.ts";
import { RATE_LIMITS } from "../_shared/rate-limits.ts";
import { claimFixedWindowRateLimits, utcMinuteWindow, utcSecondWindow } from "../_shared/upstash-rate-limit.ts";
import { requireBearerSecret } from "../_shared/webhook.ts";
import { syncIssueSupportToNotion } from "../_shared/notion.ts";

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

    const { data: dirtyIssues, error: claimError } = await supabase
      .schema("app_api")
      .rpc("claim_notion_support_dirty", { batch_size: 100 });
    if (claimError) throw claimError;
    let syncedSupportCount = 0;
    const syncDirtyIssue = async (row: { issue_id?: string; updated_at?: string }) => {
      const issueId = String(row.issue_id ?? "");
      if (!issueId) return;
      try {
        await syncIssueSupportToNotion(supabase, issueId, { appendTimeline: false });
        const { error: completeError } = await supabase
          .schema("app_api")
          .rpc("complete_notion_support_dirty", {
            claimed_updated_at: String(row.updated_at),
            issue_id: issueId,
          });
        if (completeError) throw completeError;
        syncedSupportCount += 1;
      } catch (syncError) {
        const { error: releaseError } = await supabase
          .schema("app_api")
          .rpc("release_notion_support_dirty", { issue_id: issueId });
        if (releaseError) console.error(errorMessage(releaseError));
        console.error(errorMessage(syncError));
      }
    };
    const rows = dirtyIssues ?? [];
    for (let offset = 0; offset < rows.length; offset += 5) {
      await Promise.all(rows.slice(offset, offset + 5).map(syncDirtyIssue));
    }

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

    return jsonResponse({ ok: true, result: data, syncedSupportCount, workers: workerResults });
  } catch (error) {
    console.error(errorMessage(error));
    return jsonResponse({ ok: false, error: publicError(error) }, { status: errorStatus(error) });
  }
});
