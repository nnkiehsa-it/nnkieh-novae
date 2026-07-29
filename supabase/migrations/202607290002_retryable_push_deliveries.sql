-- Turn push delivery diagnostics into a retryable, leased delivery ledger.

alter table app_private.push_delivery_logs
  drop constraint if exists push_delivery_logs_status_check;
alter table app_private.push_delivery_logs
  add constraint push_delivery_logs_status_check
  check (status in ('pending', 'processing', 'sent', 'failed'));

alter table app_private.push_delivery_logs
  add column delivery_key text unique,
  add column notification jsonb,
  add column recipient_uids text[] not null default '{}',
  add column attempt_count integer not null default 0 check (attempt_count >= 0),
  add column next_attempt_at timestamptz not null default now(),
  add column locked_at timestamptz;

create index push_delivery_logs_retry_idx
  on app_private.push_delivery_logs(next_attempt_at, created_at)
  where status in ('pending', 'failed', 'processing') and notification is not null;

create function app_api.claim_push_delivery_jobs(batch_size integer default 10)
returns setof app_private.push_delivery_logs
language plpgsql
security definer
set search_path = app_private, public
as $$
begin
  return query
  with claimed as (
    select id
    from app_private.push_delivery_logs
    where notification is not null
      and attempt_count < 8
      and (
        (status in ('pending', 'failed') and next_attempt_at <= now())
        or (status = 'processing' and locked_at < now() - interval '10 minutes')
      )
    order by next_attempt_at, created_at
    limit greatest(1, least(batch_size, 25))
    for update skip locked
  )
  update app_private.push_delivery_logs job
  set status = 'processing',
      attempt_count = job.attempt_count + 1,
      locked_at = now(),
      updated_at = now()
  from claimed
  where job.id = claimed.id
  returning job.*;
end;
$$;

create function app_api.complete_push_delivery_job(job_id uuid)
returns void
language sql
security definer
set search_path = app_private, public
as $$
  update app_private.push_delivery_logs
  set status = 'sent',
      notification = null,
      recipient_uids = '{}',
      locked_at = null,
      updated_at = now()
  where id = job_id and status = 'processing';
$$;

create function app_api.fail_push_delivery_job(job_id uuid, trace_id uuid)
returns void
language sql
security definer
set search_path = app_private, public
as $$
  update app_private.push_delivery_logs
  set status = 'failed',
      error_trace_id = trace_id,
      next_attempt_at = now() + make_interval(
        secs => least(3600, (15 * power(2, greatest(0, attempt_count - 1)))::integer)
      ),
      locked_at = null,
      updated_at = now()
  where id = job_id and status = 'processing';
$$;

revoke all on function app_api.claim_push_delivery_jobs(integer) from public,anon,authenticated;
revoke all on function app_api.complete_push_delivery_job(uuid) from public,anon,authenticated;
revoke all on function app_api.fail_push_delivery_job(uuid,uuid) from public,anon,authenticated;
grant execute on function app_api.claim_push_delivery_jobs(integer) to service_role;
grant execute on function app_api.complete_push_delivery_job(uuid) to service_role;
grant execute on function app_api.fail_push_delivery_job(uuid,uuid) to service_role;
