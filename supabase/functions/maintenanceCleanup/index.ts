import { createDatabaseClient } from "../_shared/database-client.ts";
import { asRecord, errorMessage, errorStatus, jsonResponse, publicErrorBody, requireMethod } from "../_shared/http.ts";
import { requireEnv } from "../_shared/env.ts";
import { RATE_LIMITS } from "../_shared/rate-limits.ts";
import { DATA_RETENTION } from "../_shared/data-retention.ts";
import { claimFixedWindowRateLimits, utcMinuteWindow, utcSecondWindow } from "../_shared/upstash-rate-limit.ts";
import { requireBearerSecret } from "../_shared/webhook.ts";
import { edgeFunctionUrl, requireOriginSecret } from "../_shared/origin.ts";

Deno.serve(async (request) => {
  const originFailure = requireOriginSecret(request);
  if (originFailure) return originFailure;
  const methodFailure = requireMethod(request, "POST");
  if (methodFailure) return methodFailure;

  const authFailure = requireBearerSecret(request);
  if (authFailure) return authFailure;

  try {
    await claimFixedWindowRateLimits([
      { identifier: "global", actionName: "worker.maintenance.second", window: utcSecondWindow(), config: RATE_LIMITS.workerRunSecond },
      { identifier: "global", actionName: "worker.maintenance", window: utcMinuteWindow(), config: RATE_LIMITS.workerRunMinute },
    ]);
    const supabase = createDatabaseClient();
    const { data, error } = await supabase
      .schema("app_api")
      .rpc("run_scheduled_maintenance_cleanup", {
        retention_config: DATA_RETENTION,
      });
    if (error) throw error;
    const snapshot = asRecord(data);
    const dueWorkers = asRecord(snapshot.dueWorkers);
    const authorization = `Bearer ${requireEnv("WEBHOOK_SECRET")}`;
    const originSecret = requireEnv("EDGE_ORIGIN_SECRET");
    const workers = [
      { due: dueWorkers.deletion === true, name: "processDeletionJobs", url: edgeFunctionUrl("delete") },
      { due: dueWorkers.outbox === true, name: "outboxWorker", url: edgeFunctionUrl("outbox") },
    ].filter(({ due }) => due);
    const workerResults = await Promise.all(workers.map(async ({ name, url }) => {
      const response = await fetch(url, {
        method: "POST",
        headers: { authorization, "content-type": "application/json", "x-novae-origin-secret": originSecret },
        body: JSON.stringify({ signal: "maintenance_backlog" }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`${name}-failed`);
      return await response.json();
    }));
    return jsonResponse({ ok: true, result: snapshot.result, workers: workerResults });
  } catch (error) {
    console.error(errorMessage(error));
    return jsonResponse({ ok: false, error: publicErrorBody(error) }, { status: errorStatus(error) });
  }
});
