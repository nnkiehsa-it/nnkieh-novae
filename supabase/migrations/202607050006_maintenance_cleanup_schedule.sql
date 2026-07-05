alter table app_private.maintenance_runs
  add column if not exists details jsonb not null default '{}'::jsonb;

create index if not exists notifications_expires_idx
  on app_private.notifications (expires_at);

create index if not exists outbox_events_expiry_idx
  on app_private.outbox_events (expires_at)
  where status in ('completed', 'failed');

create index if not exists uploads_cleanup_idx
  on app_private.uploads (status, updated_at, created_at)
  where status in ('pending', 'ready', 'failed');

create index if not exists deletion_jobs_completed_updated_idx
  on app_private.deletion_jobs (status, updated_at)
  where status in ('completed', 'failed');

create index if not exists push_tokens_updated_idx
  on app_private.push_tokens (updated_at);

create or replace function app_private.run_maintenance_cleanup()
returns jsonb
language plpgsql
security definer
set search_path = app_private, public
as $$
declare
  cleanup_details jsonb := '{}'::jsonb;
  deleted_count integer := 0;
  failed_deletion_jobs_too_old integer := 0;
  queued_count integer := 0;
  run_id uuid;
  run_status text := 'success';
begin
  insert into app_private.maintenance_runs (task_name, status, started_at)
  values ('maintenance.cleanup', 'running', now())
  returning id into run_id;

  with stale_uploads as (
    select id, cloudinary_public_id
    from app_private.uploads
    where cloudinary_public_id is not null
      and (
        (status = 'pending' and created_at < now() - interval '24 hours')
        or (status = 'ready' and attached_target_id is null and updated_at < now() - interval '7 days')
        or (status = 'failed' and updated_at < now() - interval '7 days')
      )
  ),
  queued_upload_deletions as (
    insert into app_private.deletion_jobs (target_type, target_id, cloudinary_public_id)
    select 'upload', id::text, cloudinary_public_id
    from stale_uploads
    returning 1
  ),
  deleted_uploads as (
    delete from app_private.uploads
    where id in (select id from stale_uploads)
    returning 1
  )
  select
    (select count(*) from queued_upload_deletions),
    (select count(*) from deleted_uploads)
  into queued_count, deleted_count;
  cleanup_details := cleanup_details || jsonb_build_object(
    'uploads_queued_for_deletion', queued_count,
    'uploads_deleted', deleted_count
  );

  delete from app_private.notifications
  where expires_at < now();
  get diagnostics deleted_count = row_count;
  cleanup_details := cleanup_details || jsonb_build_object('notifications_deleted', deleted_count);

  delete from app_private.outbox_events
  where status in ('completed', 'failed')
    and expires_at < now();
  get diagnostics deleted_count = row_count;
  cleanup_details := cleanup_details || jsonb_build_object('outbox_events_deleted', deleted_count);

  delete from app_private.push_delivery_logs
  where updated_at < now() - interval '7 days';
  get diagnostics deleted_count = row_count;
  cleanup_details := cleanup_details || jsonb_build_object('push_delivery_logs_deleted', deleted_count);

  delete from app_private.idempotency_keys
  where expires_at < now();
  get diagnostics deleted_count = row_count;
  cleanup_details := cleanup_details || jsonb_build_object('idempotency_keys_deleted', deleted_count);

  delete from app_private.push_tokens
  where permission <> 'granted'
    or updated_at < now() - interval '90 days';
  get diagnostics deleted_count = row_count;
  cleanup_details := cleanup_details || jsonb_build_object('push_tokens_deleted', deleted_count);

  delete from app_private.deletion_jobs
  where status = 'completed'
    and updated_at < now() - interval '7 days';
  get diagnostics deleted_count = row_count;
  cleanup_details := cleanup_details || jsonb_build_object('completed_deletion_jobs_deleted', deleted_count);

  select count(*)::integer
  into failed_deletion_jobs_too_old
  from app_private.deletion_jobs
  where status = 'failed'
    and updated_at < now() - interval '30 days';
  cleanup_details := cleanup_details || jsonb_build_object('failed_deletion_jobs_too_old', failed_deletion_jobs_too_old);

  if failed_deletion_jobs_too_old > 0 then
    run_status := 'attention';
  end if;

  delete from app_private.maintenance_runs
  where task_name = 'maintenance.cleanup'
    and id <> run_id
    and started_at < now() - interval '90 days';

  update app_private.maintenance_runs
  set
    status = run_status,
    completed_at = now(),
    details = cleanup_details
  where id = run_id;

  return jsonb_build_object(
    'ok', true,
    'run_id', run_id,
    'status', run_status,
    'details', cleanup_details
  );
exception
  when others then
    if run_id is not null then
      update app_private.maintenance_runs
      set
        status = 'failed',
        completed_at = now(),
        error = left(sqlerrm, 1000),
        details = cleanup_details
      where id = run_id;
    end if;
    raise;
end;
$$;

create or replace function app_api.run_maintenance_cleanup()
returns jsonb
language sql
security definer
set search_path = app_private, app_api, public
as $$
  select app_private.run_maintenance_cleanup();
$$;

grant execute on function app_api.run_maintenance_cleanup() to service_role;

do $$
begin
  create extension if not exists pg_cron;
exception
  when others then
    raise notice 'pg_cron extension is not available: %', sqlerrm;
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'srp_maintenance_cleanup';

    perform cron.schedule(
      'srp_maintenance_cleanup',
      '17 19 * * *',
      'select app_private.run_maintenance_cleanup();'
    );
  end if;
end $$;
