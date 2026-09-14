import { forgetOperationPolicies, readOperationPolicies, validateOperationPolicies } from '../shared/operation-policies';
import { settledSegments } from './segments.ts';
import type { AuthContext, BackendDatabase, JsonRecord } from './types';
import { providerDiagnostics } from '../shared/provider-diagnostics';
import { notionEnabled } from '../shared/notion-api';

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
  if (action === 'rebuildNotionArchive') {
    if (!notionEnabled()) throw new Error('service-not-configured');
    const queued = await database.sqlOne<{ already_queued: boolean; id: string }>`
      with existing as (
        select id from app_private.background_jobs
        where job_type = 'notion_reconcile' and status in ('pending', 'processing')
        order by created_at desc limit 1
      ), inserted as (
        insert into app_private.background_jobs (job_type, scope_id, payload, created_by)
        select 'notion_reconcile', 'global', ${JSON.stringify({ schemaVersion: 2 })}::jsonb, ${auth.uid}
        where not exists (select 1 from existing)
        returning id
      )
      select id, false as already_queued from inserted
      union all
      select id, true as already_queued from existing
      limit 1`;
    return { alreadyQueued: queued.already_queued, jobId: queued.id, success: true };
  }
  if (action === 'retryOperationalWork') {
    if (typeof payload.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(payload.id)) throw new Error('validation-invalid');
    if (payload.kind === 'cleanup') {
      const restored = await database.sql`with source as (
        delete from app_private.external_cleanup_backlog where job_id = ${payload.id} returning *
      ) insert into app_private.background_jobs (id, job_type, payload, created_by)
        select job_id, 'deletion', payload, ${auth.uid} from source returning id`;
      if (restored.rows.length !== 1) throw new Error('validation-invalid');
      return { success: true, id: payload.id };
    }
    if (payload.kind !== 'job' && payload.kind !== 'delivery') throw new Error('validation-invalid');
    const retried = payload.kind === 'job'
      ? await database.sql`update app_private.background_jobs set status = 'pending', attempt_count = 0,
        locked_at = null, last_attempt_id = null, next_attempt_at = now(), updated_at = now()
        where id = ${payload.id} and status = 'failed' returning id`
      : await database.sql`update app_private.event_deliveries set status = 'pending', attempt_count = 0,
        locked_at = null, last_attempt_id = null, next_attempt_at = now(), updated_at = now()
        where id = ${payload.id} and status = 'failed' returning id`;
    if (retried.rows.length !== 1) throw new Error('validation-invalid');
    return { success: true, id: payload.id };
  }
  if (action === 'saveOperationPolicies') {
    const values = validateOperationPolicies(payload.values);
    if (!Number.isInteger(payload.revision) || typeof payload.reason !== 'string') throw new Error('validation-invalid');
    const saved = await database.sqlOne<{ value: unknown }>`
      select app_api.save_operation_policies(
        ${auth.uid}, ${payload.revision}, ${JSON.stringify(values)}::jsonb, ${payload.reason}) as value`;
    forgetOperationPolicies();
    return saved.value;
  }
  if (action === 'getOperationsConsole') {
    const page = payload.page ?? 0;
    if (!Number.isInteger(page) || Number(page) < 0 || Number(page) > 1_000_000) throw new Error('validation-invalid');
    return operationsConsole(Number(page) * 100, database);
  }
  throw new Error('invalid-action');
}

/**
 * The operations console, sent one reading at a time.
 *
 * Ten readings, none of which needs another: the screen used to wait for the
 * slowest before it could show any of them, and now each panel fills in as its
 * own reading lands.
 */
function operationsConsole(offset: number, database: BackendDatabase) {
  const paged = {
    cleanupBacklog: database.sql`select job_id, created_at, payload from app_private.external_cleanup_backlog
      order by created_at, job_id limit 101 offset ${offset}`,
    errors: database.sql`select * from app_private.operational_errors
      order by last_at desc, action, code, status limit 101 offset ${offset}`,
    failedDeliveries: database.sql`select d.id, d.destination, d.attempt_count, d.error_detail, d.last_attempt_id,
      e.event_type, e.aggregate_id, e.operation_id from app_private.event_deliveries d
      join app_private.domain_events e on e.event_id = d.event_id where d.status = 'failed'
      order by d.updated_at desc, d.id desc limit 101 offset ${offset}`,
    history: database.sql`select id, actor_uid, revision, reason, before_value, after_value, created_at
      from app_private.operation_policy_history order by id desc limit 101 offset ${offset}`,
    jobs: database.sql`select id, job_type, status, attempt_count, processed_rows, affected_rows,
      estimated_rows, next_attempt_at, started_at, completed_at, updated_at, last_attempt_id, error_detail
      from app_private.background_jobs order by created_at desc, id desc limit 101 offset ${offset}`,
  };
  const capacity = database.sql`select relname as name, n_live_tup as rows, n_dead_tup as dead_rows,
    pg_table_size(relid) as table_bytes, pg_indexes_size(relid) as index_bytes,
    pg_total_relation_size(relid) as total_bytes, last_autovacuum, last_autoanalyze
    from pg_stat_user_tables where schemaname = 'app_private'
    order by pg_total_relation_size(relid) desc`;
  const deliveries = database.sql`select destination, status, count(*)::bigint as count, min(created_at) as oldest_at
    from app_private.event_deliveries group by destination, status`;
  const metrics = database.sql`select * from app_private.operational_metrics order by bucket desc limit 365`;
  const size = database.sqlOne<{ bytes: number }>`select pg_database_size(current_database()) as bytes`;
  const firstHundred = (page: typeof paged[keyof typeof paged]) => page.then((result) => result.rows.slice(0, 100));

  return settledSegments({
    capacity: capacity.then((result) => result.rows),
    cleanupBacklog: firstHundred(paged.cleanupBacklog),
    databaseBytes: size.then((result) => result.bytes),
    deliveries: deliveries.then((result) => result.rows),
    errors: firstHundred(paged.errors),
    failedDeliveries: firstHundred(paged.failedDeliveries),
    hasMore: Promise.all(Object.values(paged)).then((results) => results.some((result) => result.rows.length > 100)),
    history: firstHundred(paged.history),
    jobs: firstHundred(paged.jobs),
    metrics: metrics.then((result) => result.rows),
    sampledAt: Promise.resolve(new Date().toISOString()),
    settings: readOperationPolicies(database),
  });
}
