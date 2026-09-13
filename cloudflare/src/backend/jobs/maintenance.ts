import type { AppDatabaseClient } from "../database/client.ts";
import { asRecord } from "../shared/http.ts";
import { createFunctionLogger } from "../shared/observability.ts";
import { loadOperationPolicies } from "../shared/operation-policies.ts";

export async function runMaintenance(database: AppDatabaseClient) {
  const log = createFunctionLogger("maintenanceCleanup");
  const { values } = await loadOperationPolicies(database);
  await database.query(`delete from app_private.notion_pages where (target_type,target_id) in (
    select target_type,target_id from app_private.notion_pages
    where target_type not in ('issue','facility','announcement') and updated_at < now()-make_interval(days=>$1::integer)
    order by updated_at limit 100)`,[values.notionArchiveDays]);
  await database.query(`delete from app_private.operation_policy_history where created_at < now() - make_interval(days =>
    (app_private.runtime_retention_config()->>'adminAuditDays')::integer)`);
  await database.query('delete from app_private.operational_errors where bucket < current_date - $1::integer', [values.errorRetentionDays]);
  await database.query('delete from app_private.operational_metrics where bucket < current_date - $1::integer', [values.metricsRetentionDays]);
  await database.query(`insert into app_private.operational_metrics(database_bytes) values(pg_database_size(current_database()))
    on conflict(bucket) do update set database_bytes=excluded.database_bytes,measured_at=now()`);
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
    jobsDue: dueWorkers.jobs === true,
    expiredSupportCount: Number(expiredSupportCount ?? 0),
    deliveriesDue: dueWorkers.deliveries === true,
    result: snapshot.result,
  };
  log.success("maintenance.completed", {
    jobsDue: result.jobsDue,
    expiredSupportCount: result.expiredSupportCount,
    deliveriesDue: result.deliveriesDue,
    status: 200,
  });
  return result;
}
