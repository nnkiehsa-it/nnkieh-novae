create function app_api.backend_list_deletion_jobs(
  actor_uid text,
  page_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
declare
  limited_size integer := least(greatest(coalesce(page_limit, 50), 1), 100);
begin
  if not exists (
    select 1
    from app_private.user_role_assignments assignment
    join app_private.role_permissions permission
      on permission.role_code = assignment.role_code
    where assignment.uid = backend_list_deletion_jobs.actor_uid
      and permission.permission_code = 'dashboard.view'
  ) then
    raise exception 'permission-denied';
  end if;

  return jsonb_build_object(
    'entries', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', job.id,
          'targetType', job.target_type,
          'targetId', job.target_id,
          'cloudinaryPublicId', job.cloudinary_public_id,
          'status', job.status,
          'attemptCount', job.attempt_count,
          'nextAttemptAtMs', floor(extract(epoch from job.next_attempt_at) * 1000),
          'errorTraceId', job.error_trace_id,
          'createdAtMs', floor(extract(epoch from job.created_at) * 1000),
          'updatedAtMs', floor(extract(epoch from job.updated_at) * 1000)
        )
        order by job.updated_at desc, job.id desc
      )
      from (
        select *
        from app_private.deletion_jobs
        where status = 'failed'
        order by updated_at desc, id desc
        limit limited_size
      ) job
    ), '[]'::jsonb)
  );
end;
$$;

create function app_api.backend_retry_deletion_job(
  actor_uid text,
  job_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
declare
  job app_private.deletion_jobs%rowtype;
begin
  if not exists (
    select 1
    from app_private.user_role_assignments assignment
    join app_private.role_permissions permission
      on permission.role_code = assignment.role_code
    where assignment.uid = backend_retry_deletion_job.actor_uid
      and permission.permission_code = 'role.manage'
  ) then
    raise exception 'permission-denied';
  end if;

  select * into job
  from app_private.deletion_jobs
  where id = backend_retry_deletion_job.job_id
  for update;

  if not found then raise exception 'not-found'; end if;
  if job.status <> 'failed' then raise exception 'validation-invalid'; end if;

  update app_private.deletion_jobs
  set status = 'pending',
      attempt_count = 0,
      next_attempt_at = now(),
      error_trace_id = null,
      locked_at = null,
      updated_at = now()
  where id = job.id;

  insert into app_private.admin_audit_log(
    actor_uid, action, domain, target_id, detail
  ) values (
    backend_retry_deletion_job.actor_uid,
    'retryDeletionJob',
    'media-deletion',
    job.id::text,
    jsonb_build_object(
      'targetType', job.target_type,
      'targetId', job.target_id,
      'previousAttemptCount', job.attempt_count,
      'previousErrorTraceId', job.error_trace_id
    )
  );

  return jsonb_build_object(
    'id', job.id,
    'status', 'pending',
    'queuedAtMs', floor(extract(epoch from now()) * 1000)
  );
end;
$$;

revoke all on function app_api.backend_list_deletion_jobs(text, integer) from public;
revoke all on function app_api.backend_retry_deletion_job(text, uuid) from public;
