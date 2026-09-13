import type { DatabaseSession } from '../database/client';
import { publicErrorCode } from './http';
import { createFunctionLogger } from './observability';

export async function recordOperationalError(database: DatabaseSession, action: string, error: unknown, status: number, operationId: string, failureId?: string) {
  try {
    await database.query(`insert into app_private.operational_errors(action,code,status,operation_id,failure_id)
      values($1,$2,$3,$4,$5) on conflict(bucket,action,code,status) do update
      set count=operational_errors.count+1,last_at=now(),operation_id=excluded.operation_id,failure_id=excluded.failure_id`,
    [action.slice(0,120), publicErrorCode(error), status, operationId, failureId ?? null]);
  } catch (telemetryError) {
    createFunctionLogger('operationalTelemetry').error('telemetry.failed', telemetryError);
  }
}
