import type { AppDatabaseClient } from "../database/client.ts";
import { asRecord } from "../shared/http.ts";
import { createFunctionLogger } from "../shared/observability.ts";

export async function runMaintenance(database: AppDatabaseClient) {
  const log = createFunctionLogger("maintenanceCleanup");
  const { data: expiredSupportCount, error: supportError } = await database.call(
    "app_api",
    "reject_expired_support_issues",
  );
  if (supportError) throw supportError;
  const { data, error } = await database.call("app_api", "run_scheduled_maintenance_cleanup");
  if (error) throw error;
  const snapshot = asRecord(data);
  const dueWorkers = asRecord(snapshot.dueWorkers);
  const result = {
    deletionDue: dueWorkers.deletion === true,
    expiredSupportCount: Number(expiredSupportCount ?? 0),
    outboxDue: dueWorkers.outbox === true,
    result: snapshot.result,
  };
  log.success("maintenance.completed", {
    deletionDue: result.deletionDue,
    expiredSupportCount: result.expiredSupportCount,
    outboxDue: result.outboxDue,
    status: 200,
  });
  return result;
}
