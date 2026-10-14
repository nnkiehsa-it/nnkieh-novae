import type { ActionInput } from '../../../../shared/actions.ts';
import { forgetOperationPolicies, readOperationPolicies } from '../shared/operation-policies';
import { settledSegments } from './segments.ts';
import type { AuthContext, BackendDatabase } from './types';
import { providerDiagnostics } from '../shared/provider-diagnostics';
import { notionEnabled } from '../shared/notion-api';

/** The console reads and repairs the whole platform, so it is for platform administrators alone. */
function requireAdministrator(auth: AuthContext) {
  if (!auth.isAdmin) throw new Error('permission-denied');
}

const PAGE = 100;

export async function getRuntimePolicies(_input: ActionInput<'getRuntimePolicies'>, _auth: AuthContext, database: BackendDatabase) {
  return await readOperationPolicies(database);
}

export async function getProviderDiagnostics(input: ActionInput<'getProviderDiagnostics'>, auth: AuthContext) {
  requireAdministrator(auth);
  return await providerDiagnostics(input.provider, { cursor: input.cursor, query: input.query, until: input.until });
}

export async function rebuildNotionArchive(_input: ActionInput<'rebuildNotionArchive'>, auth: AuthContext, database: BackendDatabase) {
  requireAdministrator(auth);
  if (!notionEnabled()) throw new Error('service-not-configured');
  // Two administrators asking at the same instant still leave exactly one fresh rebuild.
  await database.sql`select pg_advisory_xact_lock(hashtext('novae:notion-rebuild'))`;
  const cleared = await clearSupersededNotionWork(database);
  const queued = await database.sqlOne<{ id: string }>`
    insert into app_private.background_jobs (job_type, scope_id, payload, created_by)
    values ('notion_reconcile', 'global', ${JSON.stringify({ schemaVersion: 2 })}::jsonb, ${auth.uid})
    returning id`;
  return { cleared, jobId: queued.id, success: true };
}

export async function clearOperationalErrors(_input: ActionInput<'clearOperationalErrors'>, auth: AuthContext, database: BackendDatabase) {
  requireAdministrator(auth);
  const errors = await database.sql`delete from app_private.operational_errors returning bucket`;
  return { cleared: errors.rows.length, success: true };
}

export async function clearScheduledWork(_input: ActionInput<'clearScheduledWork'>, auth: AuthContext, database: BackendDatabase) {
  requireAdministrator(auth);
  const jobs = await database.sql`update app_private.background_jobs
    set status = 'superseded', locked_at = null, updated_at = now()
    where status in ('pending', 'processing', 'failed') returning id`;
  const cleanup = await database.sql`delete from app_private.external_cleanup_backlog returning job_id`;
  return {
    cleanup: cleanup.rows.length,
    cleared: jobs.rows.length + cleanup.rows.length,
    jobs: jobs.rows.length,
    success: true,
  };
}

/** Failed work asked to run again: one piece, or everything that failed at once. */
export async function retryOperationalWork(input: ActionInput<'retryOperationalWork'>, auth: AuthContext, database: BackendDatabase) {
  requireAdministrator(auth);
  if (input.kind === 'all') return { retried: await retryEverythingFailed(auth.uid, database), success: true };
  const retried = input.kind === 'cleanup'
    ? await database.sql`with source as (
        delete from app_private.external_cleanup_backlog where job_id = ${input.id} returning *
      ) insert into app_private.background_jobs (id, job_type, payload, created_by)
        select job_id, 'deletion', payload, ${auth.uid} from source returning id`
    : input.kind === 'job'
      ? await database.sql`update app_private.background_jobs set status = 'pending', attempt_count = 0,
        locked_at = null, last_attempt_id = null, next_attempt_at = now(), updated_at = now()
        where id = ${input.id} and status = 'failed' returning id`
      : await database.sql`update app_private.event_deliveries set status = 'pending', attempt_count = 0,
        locked_at = null, last_attempt_id = null, next_attempt_at = now(), updated_at = now()
        where id = ${input.id} and status = 'failed' returning id`;
  if (retried.rows.length !== 1) throw new Error('validation-invalid');
  return { retried: 1, success: true };
}

export async function saveOperationPolicies(input: ActionInput<'saveOperationPolicies'>, auth: AuthContext, database: BackendDatabase) {
  requireAdministrator(auth);
  const saved = await database.sqlOne<{ value: unknown }>`
    select app_api.save_operation_policies(
      ${auth.uid}, ${input.revision}, ${JSON.stringify(input.values)}::jsonb, ${input.reason}) as value`;
  forgetOperationPolicies();
  return saved.value;
}

export async function getOperationPolicies(_input: ActionInput<'getOperationPolicies'>, auth: AuthContext, database: BackendDatabase) {
  requireAdministrator(auth);
  const [settings, history] = await Promise.all([
    readOperationPolicies(database),
    database.sql`select id, actor_uid as "actorUid", revision, reason, before_value as "beforeValue",
      after_value as "afterValue", created_at as "createdAt"
      from app_private.operation_policy_history order by id desc limit ${PAGE}`,
  ]);
  return { settings, history: history.rows };
}

export async function getOperationsQueue(input: ActionInput<'getOperationsQueue'>, auth: AuthContext, database: BackendDatabase) {
  requireAdministrator(auth);
  const panels = operationsQueue(input.page * PAGE, database);
  const entries = await Promise.all(Object.entries(panels).map(async ([key, panel]) => [key, await panel] as const));
  return Object.fromEntries(entries);
}

/** The queue and what the database is taking up, each panel sent as its query finishes. */
export function getOperationsConsole(input: ActionInput<'getOperationsConsole'>, auth: AuthContext, database: BackendDatabase) {
  requireAdministrator(auth);
  return settledSegments({
    ...operationsQueue(input.page * PAGE, database),
    capacity: database.sql`select relname as name, n_live_tup as rows, n_dead_tup as "deadRows",
      pg_total_relation_size(relid) as "totalBytes"
      from pg_stat_user_tables where schemaname = 'app_private'
      order by pg_total_relation_size(relid) desc`.then((result) => result.rows),
    metrics: database.sql`select bucket, database_bytes as "databaseBytes"
      from app_private.operational_metrics order by bucket desc limit 365`.then((result) => result.rows),
    databaseBytes: database.sqlOne<{ bytes: number }>`select pg_database_size(current_database()) as bytes`.then((result) => result.bytes),
  });
}

/**
 * Everything the new archive replaces, retired before its fresh job is queued.
 *
 * Rebuilds are replacement operations, not retries. Waiting, running and failed
 * Notion deliveries describe pages this rebuild writes again. Previous rebuild
 * jobs and Notion-only deletion work are fenced as superseded, so an in-flight
 * legacy worker cannot write its status back after the new rebuild starts.
 * Cloudinary deletion work and every non-Notion delivery remain untouched.
 */
async function clearSupersededNotionWork(database: BackendDatabase) {
  const deliveries = await database.sql`delete from app_private.event_deliveries
    where destination = 'notion' and status in ('pending', 'processing', 'failed') returning id`;
  const rebuildJobs = await database.sql`update app_private.background_jobs
    set status = 'superseded', locked_at = null, updated_at = now()
    where job_type = 'notion_reconcile' and status in ('pending', 'processing', 'failed') returning id`;
  const deletionJobs = await database.sql`update app_private.background_jobs
    set status = 'superseded', locked_at = null, updated_at = now()
    where job_type = 'deletion' and status in ('pending', 'processing', 'failed')
      and nullif(payload->>'notion_page_id', '') is not null
      and nullif(payload->>'cloudinary_public_id', '') is null
    returning id`;
  const cleanup = await database.sql`delete from app_private.external_cleanup_backlog
    where nullif(payload->>'notion_page_id', '') is not null
      and nullif(payload->>'cloudinary_public_id', '') is null
    returning job_id`;
  const mappings = await database.sql`delete from app_private.notion_pages returning target_id`;
  return {
    cleanup: cleanup.rows.length,
    deliveries: deliveries.rows.length,
    jobs: rebuildJobs.rows.length + deletionJobs.rows.length,
    mappings: mappings.rows.length,
  };
}

/**
 * Work still running or stopped, and refusals already counted: one page of
 * each, with whether any of them has another.
 */
function operationsQueue(offset: number, database: BackendDatabase) {
  const paged = {
    cleanupBacklog: database.sql`select job_id as "jobId", created_at as "createdAt", payload
      from app_private.external_cleanup_backlog
      order by created_at, job_id limit ${PAGE + 1} offset ${offset}`,
    errors: database.sql`select action, code, status, count, last_at as "lastAt",
      operation_id as "operationId", failure_id as "failureId"
      from app_private.operational_errors
      order by last_at desc, action, code, status limit ${PAGE + 1} offset ${offset}`,
    failedDeliveries: database.sql`select d.id, d.destination, d.attempt_count as "attemptCount",
      d.error_detail as "errorDetail", d.last_attempt_id as "lastAttemptId",
      e.event_type as "eventType", e.operation_id as "operationId"
      from app_private.event_deliveries d
      join app_private.domain_events e on e.event_id = d.event_id where d.status = 'failed'
      order by d.updated_at desc, d.id desc limit ${PAGE + 1} offset ${offset}`,
    jobs: database.sql`select id, job_type as "jobType", status, attempt_count as "attemptCount",
      processed_rows as "processedRows", affected_rows as "affectedRows", estimated_rows as "estimatedRows",
      updated_at as "updatedAt", last_attempt_id as "lastAttemptId", error_detail as "errorDetail"
      from app_private.background_jobs order by created_at desc, id desc limit ${PAGE + 1} offset ${offset}`,
  };
  const firstPage = (page: typeof paged[keyof typeof paged]) => page.then((result) => result.rows.slice(0, PAGE));
  return {
    cleanupBacklog: firstPage(paged.cleanupBacklog),
    errors: firstPage(paged.errors),
    failedDeliveries: firstPage(paged.failedDeliveries),
    jobs: firstPage(paged.jobs),
    deliveries: database.sql`select destination, status, count(*)::bigint as count, min(created_at) as "oldestAt"
      from app_private.event_deliveries group by destination, status`.then((result) => result.rows),
    hasMore: Promise.all(Object.values(paged)).then((results) => results.some((result) => result.rows.length > PAGE)),
    sampledAt: Promise.resolve(new Date().toISOString()),
  };
}

/**
 * Everything that failed, asked to run again at once.
 *
 * Retrying was one row at a time, so recovering from an outage meant as many
 * admin writes as there were failures and the administrator ran into their own
 * rate limit before reaching the end of the list. The same recovery is one
 * write now, and it covers all three kinds of stopped work.
 */
async function retryEverythingFailed(uid: string, database: BackendDatabase) {
  const jobs = await database.sql`update app_private.background_jobs set status = 'pending', attempt_count = 0,
    locked_at = null, last_attempt_id = null, next_attempt_at = now(), updated_at = now()
    where status = 'failed' returning id`;
  const deliveries = await database.sql`update app_private.event_deliveries set status = 'pending', attempt_count = 0,
    locked_at = null, last_attempt_id = null, next_attempt_at = now(), updated_at = now()
    where status = 'failed' returning id`;
  const cleanup = await database.sql`with source as (
    delete from app_private.external_cleanup_backlog returning *
  ) insert into app_private.background_jobs (id, job_type, payload, created_by)
    select job_id, 'deletion', payload, ${uid} from source returning id`;
  return jobs.rows.length + deliveries.rows.length + cleanup.rows.length;
}
