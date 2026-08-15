import type { Env } from "../../types";
import { createDatabaseClient } from "../database/client.ts";
import { processDeletionBatch } from "./deletion.ts";
import { runMaintenance } from "./maintenance.ts";
import { processOutboxBatch } from "./outbox.ts";
import { processRealtimeBatch } from "./realtime.ts";

export type JobMessage = { type: "drain" | "maintenance" };

export async function processJobMessage(message: JobMessage, env: Env) {
  const database = await createDatabaseClient(env);
  try {
    let maintenance = { deletionDue: true, outboxDue: true };
    if (message.type === "maintenance") maintenance = await runMaintenance(database);

    const outbox = maintenance.outboxDue
      ? await processOutboxBatch(database)
      : { hasMore: false, processedCount: 0, retriedPushCount: 0 };
    const deletion = maintenance.deletionDue
      ? await processDeletionBatch(database)
      : { hasMore: false, processedCount: 0 };
    const realtime = await processRealtimeBatch(database, env);

    if (outbox.hasMore || deletion.hasMore || realtime.hasMore) {
      await env.JOBS.send({ type: "drain" });
    }
    return { deletion, outbox, realtime };
  } finally {
    await database.close();
  }
}
