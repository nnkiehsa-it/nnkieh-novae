import { forgetOperationPolicies, readOperationPolicies, validateOperationPolicies } from '../shared/operation-policies';
import type { AuthContext, BackendDatabase, JsonRecord } from './types';
import { providerDiagnostics } from '../shared/provider-diagnostics';

export async function handleOperationsAction(action: string, payload: JsonRecord, auth: AuthContext, database: BackendDatabase) {
  if (action === 'getRuntimePolicies') return readOperationPolicies(database);
  if (!auth.isAdmin) throw new Error('permission-denied');
  if (action === 'getProviderDiagnostics') {
    if (!['cloudinary','cloudflare','logs'].includes(String(payload.provider))) throw new Error('validation-invalid');
    if (payload.cursor !== undefined && (typeof payload.cursor !== 'string' || payload.cursor.length > 300)) throw new Error('validation-invalid');
    if (payload.query !== undefined && (typeof payload.query !== 'string' || payload.query.length > 200)) throw new Error('validation-invalid');
    if (payload.until !== undefined && (typeof payload.until !== 'number' || !Number.isSafeInteger(payload.until) || payload.until < 86400000 || payload.until > Date.now()+60000)) throw new Error('validation-invalid');
    return providerDiagnostics(String(payload.provider),{ cursor: payload.cursor as string | undefined, query: payload.query as string | undefined, until: payload.until as number | undefined });
  }
  if (action === 'retryOperationalWork') {
    if (typeof payload.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(payload.id)) throw new Error('validation-invalid');
    if (payload.kind === 'cleanup') {
      const restored = await database.query(`with source as (
        delete from app_private.external_cleanup_backlog where job_id=$1 returning *
      ) insert into app_private.background_jobs(id,job_type,payload,created_by)
        select job_id,'deletion',payload,$2 from source returning id`, [payload.id,auth.uid]);
      if (restored.rows.length !== 1) throw new Error('validation-invalid');
      return { success: true, id: payload.id };
    }
    const table = payload.kind === 'job' ? 'background_jobs' : payload.kind === 'delivery' ? 'event_deliveries' : null;
    if (!table) throw new Error('validation-invalid');
    const result = await database.query(`update app_private.${table} set status='pending',attempt_count=0,
      locked_at=null,last_attempt_id=null,next_attempt_at=now(),updated_at=now()
      where id=$1 and status='failed' returning id`, [payload.id]);
    if (result.rows.length !== 1) throw new Error('validation-invalid');
    return { success: true, id: payload.id };
  }
  if (action === 'saveOperationPolicies') {
    const values = validateOperationPolicies(payload.values);
    if (!Number.isInteger(payload.revision) || typeof payload.reason !== 'string') throw new Error('validation-invalid');
    const result = await database.query<{ value: unknown }>(
      'select app_api.save_operation_policies($1,$2,$3::jsonb,$4) as value',
      [auth.uid, payload.revision, JSON.stringify(values), payload.reason],
    );
    forgetOperationPolicies();
    return result.rows[0].value;
  }
  if (action === 'getOperationsConsole') {
    const page = payload.page ?? 0;
    if (!Number.isInteger(page) || Number(page) < 0 || Number(page) > 1_000_000) throw new Error('validation-invalid');
    const offset = [Number(page) * 100];
    const [settings, capacity, jobs, deliveries, history, errors, metrics, failedDeliveries, cleanupBacklog] = await Promise.all([
      readOperationPolicies(database),
      database.query(`select relname as name, n_live_tup as rows, n_dead_tup as dead_rows,
        pg_table_size(relid) as table_bytes, pg_indexes_size(relid) as index_bytes,
        pg_total_relation_size(relid) as total_bytes, last_autovacuum, last_autoanalyze
        from pg_stat_user_tables where schemaname='app_private'
        order by pg_total_relation_size(relid) desc`),
      database.query(`select id,job_type,status,attempt_count,processed_rows,affected_rows,
        estimated_rows,next_attempt_at,started_at,completed_at,updated_at,last_attempt_id,error_detail
        from app_private.background_jobs order by created_at desc,id desc limit 101 offset $1`,offset),
      database.query(`select destination,status,count(*)::bigint as count,min(created_at) as oldest_at
        from app_private.event_deliveries group by destination,status`),
      database.query(`select id,actor_uid,revision,reason,before_value,after_value,created_at
        from app_private.operation_policy_history order by id desc limit 101 offset $1`,offset),
      database.query('select * from app_private.operational_errors order by last_at desc,action,code,status limit 101 offset $1',offset),
      database.query('select * from app_private.operational_metrics order by bucket desc limit 365'),
      database.query(`select d.id,d.destination,d.attempt_count,d.error_detail,d.last_attempt_id,
        e.event_type,e.aggregate_id,e.operation_id from app_private.event_deliveries d
        join app_private.domain_events e on e.event_id=d.event_id where d.status='failed' order by d.updated_at desc,d.id desc limit 101 offset $1`,offset),
      database.query('select job_id,created_at,payload from app_private.external_cleanup_backlog order by created_at,job_id limit 101 offset $1',offset),
    ]);
    const size = await database.query<{ bytes: number }>('select pg_database_size(current_database()) as bytes');
    return { settings, capacity: capacity.rows, databaseBytes: size.rows[0].bytes,
      jobs: jobs.rows.slice(0,100), deliveries: deliveries.rows, history: history.rows.slice(0,100), errors: errors.rows.slice(0,100),
      metrics: metrics.rows, failedDeliveries: failedDeliveries.rows.slice(0,100), cleanupBacklog: cleanupBacklog.rows.slice(0,100),
      hasMore: [jobs,history,errors,failedDeliveries,cleanupBacklog].some(result => result.rows.length > 100),
      sampledAt: new Date().toISOString() };
  }
  throw new Error('invalid-action');
}
