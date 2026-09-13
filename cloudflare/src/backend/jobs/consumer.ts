import type { Env } from "../../types";
import { createDatabaseClient } from "../database/client.ts";
import { runMaintenance } from "./maintenance.ts";
import {
  processInAppDeliveries,
  processNotionDeliveries,
  processPushDeliveries,
  processRealtimeDeliveries,
} from "./deliveries.ts";
import { processBackgroundJobs } from "./background-jobs.ts";
import { loadOperationPolicies } from "../shared/operation-policies.ts";
import { claimFixedWindowRateLimits, utcMinuteWindow, utcSecondWindow } from "../shared/business-rate-limit.ts";
import { RATE_LIMITS } from "../shared/rate-limits.ts";
import { createFunctionLogger } from "../shared/observability.ts";

export type JobMessage = { type: "drain" | "maintenance" };

export async function processJobMessage(message: JobMessage, env: Env) {
  const database = await createDatabaseClient(env);
  try {
    const { values } = await loadOperationPolicies(database);
    await claimFixedWindowRateLimits([
      { identifier: 'background-workers', actionName: 'worker.second', window: utcSecondWindow(), config: { ...RATE_LIMITS.workerRunSecond, limit: values.workerRunSecond } },
      { identifier: 'background-workers', actionName: 'worker.minute', window: utcMinuteWindow(), config: { ...RATE_LIMITS.workerRunMinute, limit: values.workerRunMinute } },
    ]);
    if (message.type === "maintenance") {
      await runMaintenance(database);
    }

    const notion = await processNotionDeliveries(database);
    const inApp = await processInAppDeliveries(database, env);
    const push = await processPushDeliveries(database);
    const realtime = await processRealtimeDeliveries(database, env);
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
  } catch (error) {
    createFunctionLogger('jobConsumer').error('job-consumer.failed', error);
    throw error;
  } finally {
    await database.close();
  }
}
