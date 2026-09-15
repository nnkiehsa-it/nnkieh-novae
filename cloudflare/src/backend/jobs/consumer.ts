import type { Env } from "../../types";
import type { AppDatabaseClient } from "../database/client.ts";
import { createDatabaseClient } from "../database/client.ts";
import { runMaintenance } from "./maintenance.ts";
import { processNotionDeliveries } from "./notion-deliveries.ts";
import { processInAppDeliveries, processPushDeliveries } from "./notification-deliveries.ts";
import { processRealtimeDeliveries } from "./realtime-deliveries.ts";
import { processBackgroundJobs } from "./background-jobs.ts";
import { operationPolicy, withOperationPolicies } from "../shared/operation-policies.ts";
import { beginNotionInvocation } from "../shared/notion-api.ts";
import { REBUILD_REQUEST_BUDGET } from "../shared/notion-reconcile.ts";
import { claimFixedWindowRateLimits, utcMinuteWindow, utcSecondWindow } from "../shared/business-rate-limit.ts";
import { RATE_LIMITS } from "../shared/rate-limits.ts";
import { createFunctionLogger } from "../shared/observability.ts";

export type JobMessage = { type: "drain" | "maintenance" };

export async function processJobMessage(message: JobMessage, env: Env) {
  const database = await createDatabaseClient(env);
  try {
    return await withOperationPolicies(database, () => sweep(message, database, env));
  } catch (error) {
    createFunctionLogger('jobConsumer').error('job-consumer.failed', error);
    throw error;
  } finally {
    await database.close();
  }
}

/** Which destinations have something waiting, asked once for all of them. */
async function pendingDestinations(database: AppDatabaseClient) {
  const { data, error } = await database.call("app_api", "pending_delivery_destinations", {});
  if (error) throw error;
  return new Set((data ?? []) as string[]);
}

const NOTHING_DELIVERED = { hasMore: false, processedCount: 0 };

/** One bounded pass over everything the queue has to carry. */
async function sweep(message: JobMessage, database: AppDatabaseClient, env: Env) {
    // Everything this sweep sends to Notion is spending one invocation's
    // allowance, and the rebuild pacing itself against that allowance has to be
    // told when a new one begins.
    beginNotionInvocation();
    await claimFixedWindowRateLimits([
      { identifier: 'background-workers', actionName: 'worker.second', window: utcSecondWindow(), config: { ...RATE_LIMITS.workerRunSecond, limit: operationPolicy('workerRunSecond') } },
      { identifier: 'background-workers', actionName: 'worker.minute', window: utcMinuteWindow(), config: { ...RATE_LIMITS.workerRunMinute, limit: operationPolicy('workerRunMinute') } },
    ]);
    if (message.type === "maintenance") {
      await runMaintenance(database);
    }

    // A full Notion rebuild owns this queue invocation. Workers Free only has
    // 50 external subrequests per invocation; mixing a rebuild with push,
    // realtime and ordinary Notion delivery made otherwise-resumable work hit
    // the platform ceiling before its cursor could be saved.
    const activeRebuild = await database.sqlMaybe<{ id: string }>`select id
      from app_private.background_jobs where job_type = 'notion_reconcile'
        and status = any(${["pending", "processing"]}) order by created_at limit 1`;
    if (activeRebuild) {
      beginNotionInvocation(REBUILD_REQUEST_BUDGET);
      const backgroundJobs = await processBackgroundJobs(database, { batchSize: 1 });
      if (backgroundJobs.hasMore) await env.JOBS.send({ type: "drain" });
      return {
        backgroundJobs,
        inApp: NOTHING_DELIVERED,
        notion: NOTHING_DELIVERED,
        push: NOTHING_DELIVERED,
        realtime: NOTHING_DELIVERED,
      };
    }

    const pending = await pendingDestinations(database);
    const notion = pending.has("notion") ? await processNotionDeliveries(database) : NOTHING_DELIVERED;
    const inApp = pending.has("in_app") ? await processInAppDeliveries(database, env) : NOTHING_DELIVERED;
    const push = pending.has("push") ? await processPushDeliveries(database) : NOTHING_DELIVERED;
    const realtime = pending.has("realtime") ? await processRealtimeDeliveries(database, env) : NOTHING_DELIVERED;
    const backgroundJobs = await processBackgroundJobs(database);

    const hasMore =
      notion.hasMore ||
      inApp.hasMore ||
      push.hasMore ||
      realtime.hasMore ||
      backgroundJobs.hasMore;

    if (hasMore) {
      await env.JOBS.send({ type: "drain" });
    }

    return { backgroundJobs, inApp, notion, push, realtime };
}
