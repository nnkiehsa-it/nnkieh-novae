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

export type JobMessage = { type: "drain" | "maintenance" };

export async function processJobMessage(message: JobMessage, env: Env) {
  const database = await createDatabaseClient(env);
  try {
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
  } finally {
    await database.close();
  }
}
