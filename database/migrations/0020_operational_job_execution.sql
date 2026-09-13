-- Policy batches own their transactions and progress. External jobs must never
-- claim or complete a policy job without executing its data changes.
create or replace function app_api.claim_background_jobs(requested_batch_size integer default 25)
returns table(
  id uuid, job_type text, scope_id text, payload jsonb, status text,
  estimated_rows bigint, processed_rows bigint, affected_rows bigint,
  batch_size integer, attempt_count integer, last_attempt_id uuid,
  next_attempt_at timestamptz, locked_at timestamptz, started_at timestamptz,
  completed_at timestamptz, result jsonb, error_detail jsonb, created_by text,
  created_at timestamptz, updated_at timestamptz, expires_at timestamptz
)
language plpgsql security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
begin
  return query
  with claimed as (
    select candidate.id from app_private.background_jobs candidate
    where candidate.job_type in ('deletion', 'notion_reconcile')
      and candidate.attempt_count < 8
      and ((candidate.status in ('pending', 'failed') and candidate.next_attempt_at <= now())
        or (candidate.status = 'processing' and candidate.locked_at < now() - interval '10 minutes'))
    order by candidate.next_attempt_at, candidate.created_at
    limit least(greatest(coalesce(requested_batch_size, 25), 1), 100)
    for update skip locked
  ), updated as (
    update app_private.background_jobs job
    set status = 'processing', attempt_count = job.attempt_count + 1,
        last_attempt_id = gen_random_uuid(), locked_at = now(), started_at = coalesce(job.started_at, now()), updated_at = now()
    from claimed where job.id = claimed.id returning job.*
  )
  select updated.id, updated.job_type, updated.scope_id, updated.payload,
    updated.status, updated.estimated_rows, updated.processed_rows,
    updated.affected_rows, updated.batch_size, updated.attempt_count,
    updated.last_attempt_id, updated.next_attempt_at, updated.locked_at,
    updated.started_at, updated.completed_at, updated.result, updated.error_detail,
    updated.created_by, updated.created_at, updated.updated_at, updated.expires_at
  from updated;
end;
$$;

-- Requeue policy work previously completed by the consumer without processing.
-- A fresh retention job uses the current policy; category jobs are reconstructed
-- only from current category state, so obsolete historical policies cannot win.
select app_private.enqueue_policy_job(
  'retention-cleanup', 'global', app_private.runtime_retention_config(), 'migration:0020'
);
