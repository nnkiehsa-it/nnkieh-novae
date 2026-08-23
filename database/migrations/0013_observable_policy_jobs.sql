create table app_private.platform_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  scope_id text not null default 'global',
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed', 'superseded')),
  estimated_rows bigint not null default 0 check (estimated_rows >= 0),
  processed_rows bigint not null default 0 check (processed_rows >= 0),
  affected_rows bigint not null default 0 check (affected_rows >= 0),
  batch_size integer not null default 100 check (batch_size between 1 and 500),
  created_by text not null,
  result jsonb not null default '{}'::jsonb,
  error_trace_id uuid,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  locked_at timestamptz
);

create unique index platform_jobs_active_scope_idx
  on app_private.platform_jobs(job_type, scope_id)
  where status in ('pending', 'processing');
create index platform_jobs_claim_idx
  on app_private.platform_jobs(status, created_at)
  where status in ('pending', 'processing');
create index platform_jobs_recent_idx
  on app_private.platform_jobs(updated_at desc, id desc);

create function app_private.actor_has_permission(actor_uid text, permission_code text)
returns boolean
language sql
stable
security definer
set search_path to 'app_private', 'public'
as $$
  select exists (
    select 1
    from app_private.user_role_assignments assignment
    join app_private.role_permissions permission
      on permission.role_code = assignment.role_code
    where assignment.uid = actor_has_permission.actor_uid
      and permission.permission_code = actor_has_permission.permission_code
  );
$$;

create function app_private.policy_job_estimate(
  job_type text,
  scope_id text,
  payload jsonb
)
returns bigint
language plpgsql
stable
security definer
set search_path to 'app_private', 'public'
as $$
declare
  estimated bigint;
  desired boolean := coalesce((payload->>'enabled')::boolean, false);
begin
  if job_type = 'announcement-comments' then
    select count(*) into estimated
    from app_private.announcements
    where comments_enabled is distinct from desired;
  elsif job_type = 'issue-category-comments' then
    select count(*) into estimated
    from app_private.issues issue
    where issue.category = policy_job_estimate.scope_id
      and issue.comments_enabled is distinct from (
        desired and issue.status not in ('completed', 'infeasible', 'review-rejected', 'auto-rejected')
      );
  else
    raise exception 'validation-invalid';
  end if;
  return estimated;
end;
$$;

create function app_private.enqueue_policy_job(
  job_type text,
  scope_id text,
  payload jsonb,
  actor_uid text
)
returns uuid
language plpgsql
security definer
set search_path to 'app_private', 'public'
as $$
declare
  estimate bigint;
  next_id uuid;
  next_status text;
begin
  estimate := app_private.policy_job_estimate(job_type, scope_id, payload);

  update app_private.platform_jobs
  set status = 'superseded',
      completed_at = now(),
      updated_at = now(),
      locked_at = null,
      result = jsonb_build_object('reason', 'replaced-by-newer-policy')
  where platform_jobs.job_type = enqueue_policy_job.job_type
    and platform_jobs.scope_id = enqueue_policy_job.scope_id
    and status in ('pending', 'processing');

  next_status := case when estimate = 0 then 'completed' else 'pending' end;
  insert into app_private.platform_jobs(
    job_type, scope_id, payload, status, estimated_rows, created_by, completed_at, result
  ) values (
    job_type,
    scope_id,
    payload,
    next_status,
    estimate,
    coalesce(nullif(actor_uid, ''), 'system'),
    case when estimate = 0 then now() else null end,
    case when estimate = 0 then jsonb_build_object('affectedRows', 0) else '{}'::jsonb end
  ) returning id into next_id;

  return next_id;
end;
$$;

create or replace function app_private.apply_announcement_comment_setting()
returns trigger
language plpgsql
security definer
set search_path to 'app_private', 'public'
as $$
declare
  actor_uid text := nullif(current_setting('app.actor_uid', true), '');
begin
  perform app_private.enqueue_policy_job(
    'announcement-comments',
    'global',
    jsonb_build_object('enabled', new.announcement_comments_enabled),
    actor_uid
  );
  return null;
end;
$$;

create or replace function app_private.close_issue_comments_with_category()
returns trigger
language plpgsql
security definer
set search_path to 'app_private', 'public'
as $$
declare
  actor_uid text := coalesce(
    nullif(current_setting('app.actor_uid', true), ''),
    new.created_by,
    'system'
  );
begin
  if old.comments_enabled is not distinct from new.comments_enabled
    and old.is_active is not distinct from new.is_active then
    return null;
  end if;
  perform app_private.enqueue_policy_job(
    'issue-category-comments',
    new.id,
    jsonb_build_object('enabled', new.is_active and new.comments_enabled),
    actor_uid
  );
  return null;
end;
$$;

drop trigger close_issue_comments_with_category on app_private.issue_categories;
create trigger close_issue_comments_with_category
after update of comments_enabled, is_active on app_private.issue_categories
for each row execute function app_private.close_issue_comments_with_category();

create or replace function app_api.backend_save_category_management(
  actor_uid text,
  issue_categories jsonb,
  facility_categories jsonb,
  deleted_issue_category_ids text[],
  deleted_facility_category_ids text[],
  issues_enabled boolean,
  facilities_enabled boolean,
  announcement_comments_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
begin
  perform set_config('app.actor_uid', actor_uid, true);
  perform app_api.backend_save_category_management(
    actor_uid,
    issue_categories,
    facility_categories,
    deleted_issue_category_ids,
    deleted_facility_category_ids,
    issues_enabled,
    facilities_enabled
  );
  perform app_private.update_announcement_comment_setting(
    actor_uid, announcement_comments_enabled
  );
  return jsonb_build_object('success', true);
end;
$$;

create or replace function app_api.backend_update_platform_features(
  actor_uid text,
  issues_enabled boolean,
  facilities_enabled boolean,
  announcement_comments_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
declare result jsonb;
begin
  perform set_config('app.actor_uid', actor_uid, true);
  result := app_api.backend_update_platform_features(
    actor_uid, issues_enabled, facilities_enabled
  );
  perform app_private.update_announcement_comment_setting(
    actor_uid, announcement_comments_enabled
  );
  return result || jsonb_build_object(
    'announcementCommentsEnabled', announcement_comments_enabled
  );
end;
$$;

create function app_api.backend_estimate_category_policy_changes(
  actor_uid text,
  issue_categories jsonb,
  deleted_issue_category_ids text[],
  announcement_comments_enabled boolean
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
declare
  estimates jsonb;
begin
  if not app_private.actor_has_permission(actor_uid, 'category.manage') then
    raise exception 'permission-denied';
  end if;
  if jsonb_typeof(issue_categories) <> 'array' or deleted_issue_category_ids is null then
    raise exception 'validation-required';
  end if;

  with requested as (
    select value->>'id' scope_id, (value->>'commentsEnabled')::boolean enabled
    from jsonb_array_elements(issue_categories)
  ), changed_issue_policies as (
    select requested.scope_id, requested.enabled
    from requested
    join app_private.issue_categories category on category.id = requested.scope_id
    where category.comments_enabled is distinct from requested.enabled
      or not category.is_active
    union all
    select category.id, false
    from app_private.issue_categories category
    where category.id = any(deleted_issue_category_ids)
      and category.is_active
  ), rows as (
    select
      'announcement-comments'::text job_type,
      'global'::text scope_id,
      app_private.policy_job_estimate(
        'announcement-comments',
        'global',
        jsonb_build_object('enabled', announcement_comments_enabled)
      ) estimated_rows
    where announcement_comments_enabled is distinct from (
      select setup.announcement_comments_enabled
      from app_private.system_setup setup
      where setup.singleton
    )
    union all
    select
      'issue-category-comments',
      changed.scope_id,
      app_private.policy_job_estimate(
        'issue-category-comments',
        changed.scope_id,
        jsonb_build_object('enabled', changed.enabled)
      )
    from changed_issue_policies changed
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'jobType', job_type,
    'scopeId', scope_id,
    'estimatedRows', estimated_rows
  ) order by job_type, scope_id), '[]'::jsonb)
  into estimates
  from rows
  where estimated_rows > 0;

  return jsonb_build_object(
    'estimates', estimates,
    'totalEstimatedRows', coalesce((
      select sum((entry->>'estimatedRows')::bigint)
      from jsonb_array_elements(estimates) entry
    ), 0)
  );
end;
$$;

create function app_api.backend_list_platform_jobs(
  actor_uid text,
  page_limit integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
declare
  entries jsonb;
begin
  if not app_private.actor_has_permission(actor_uid, 'category.manage') then
    raise exception 'permission-denied';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', job.id,
    'jobType', job.job_type,
    'scopeId', job.scope_id,
    'status', job.status,
    'estimatedRows', job.estimated_rows,
    'processedRows', job.processed_rows,
    'affectedRows', job.affected_rows,
    'result', job.result,
    'errorTraceId', job.error_trace_id,
    'createdAtMs', floor(extract(epoch from job.created_at) * 1000),
    'updatedAtMs', floor(extract(epoch from job.updated_at) * 1000),
    'completedAtMs', case when job.completed_at is null then null
      else floor(extract(epoch from job.completed_at) * 1000) end
  ) order by job.updated_at desc, job.id desc), '[]'::jsonb)
  into entries
  from (
    select * from app_private.platform_jobs
    where status in ('pending', 'processing', 'failed')
      or updated_at >= now() - interval '24 hours'
    order by updated_at desc, id desc
    limit least(greatest(coalesce(page_limit, 30), 1), 100)
  ) job;
  return jsonb_build_object('entries', entries);
end;
$$;

create function app_api.backend_process_platform_job_batch(batch_size integer default 100)
returns jsonb
language plpgsql
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
declare
  job app_private.platform_jobs%rowtype;
  changed_count integer := 0;
  has_more boolean := false;
  batch_has_more boolean := false;
  batch_result jsonb := '{}'::jsonb;
  trace_id uuid;
  limited_size integer := least(greatest(coalesce(batch_size, 100), 1), 500);
  desired boolean;
begin
  select * into job
  from app_private.platform_jobs
  where status = 'pending'
    or (status = 'processing' and locked_at < now() - interval '5 minutes')
  order by created_at, id
  for update skip locked
  limit 1;

  if not found then return jsonb_build_object('hasMore', false, 'processedRows', 0); end if;

  update app_private.platform_jobs
  set status = 'processing',
      started_at = coalesce(started_at, now()),
      locked_at = now(),
      updated_at = now()
  where id = job.id;

  desired := coalesce((job.payload->>'enabled')::boolean, false);
  begin
    if job.job_type = 'retention-cleanup' then
      batch_result := app_private.run_retention_cleanup_batch(job.payload, limited_size);
      changed_count := coalesce((batch_result->>'affectedRows')::integer, 0);
      batch_has_more := coalesce((batch_result->>'hasMore')::boolean, false);
    elsif job.job_type = 'announcement-comments' then
      with targets as (
        select id from app_private.announcements
        where comments_enabled is distinct from desired
        order by id
        limit limited_size
      ), changed as (
        update app_private.announcements announcement
        set comments_enabled = desired
        where announcement.id in (select id from targets)
        returning 1
      ) select count(*) into changed_count from changed;
    elsif job.job_type = 'issue-category-comments' then
      with targets as (
        select id from app_private.issues issue
        where issue.category = job.scope_id
          and issue.comments_enabled is distinct from (
            desired and issue.status not in ('completed', 'infeasible', 'review-rejected', 'auto-rejected')
          )
        order by id
        limit limited_size
      ), changed as (
        update app_private.issues issue
        set comments_enabled = (
          desired and issue.status not in ('completed', 'infeasible', 'review-rejected', 'auto-rejected')
        )
        where issue.id in (select id from targets)
        returning 1
      ) select count(*) into changed_count from changed;
    else
      raise exception 'validation-invalid';
    end if;

    if (job.job_type = 'retention-cleanup' and not batch_has_more)
      or (job.job_type <> 'retention-cleanup' and changed_count < limited_size) then
      update app_private.platform_jobs
      set status = 'completed',
          processed_rows = least(estimated_rows, processed_rows + changed_count),
          affected_rows = affected_rows + changed_count,
          completed_at = now(),
          updated_at = now(),
          locked_at = null,
          result = jsonb_build_object('affectedRows', affected_rows + changed_count, 'lastBatch', batch_result)
      where id = job.id;
    else
      update app_private.platform_jobs
      set status = 'pending',
          processed_rows = least(estimated_rows, processed_rows + changed_count),
          affected_rows = affected_rows + changed_count,
          updated_at = now(),
          locked_at = null
      where id = job.id;
    end if;
  exception when others then
    trace_id := gen_random_uuid();
    update app_private.platform_jobs
    set status = 'failed',
        error_trace_id = trace_id,
        completed_at = now(),
        updated_at = now(),
        locked_at = null,
        result = jsonb_build_object('errorCode', 'policy-batch-failed')
    where id = job.id;
  end;

  select exists (
    select 1 from app_private.platform_jobs
    where status = 'pending'
      or (status = 'processing' and locked_at < now() - interval '5 minutes')
  ) into has_more;

  return jsonb_build_object(
    'hasMore', has_more or batch_has_more or (job.job_type <> 'retention-cleanup' and changed_count = limited_size),
    'jobId', job.id,
    'processedRows', changed_count
  );
end;
$$;

revoke all on table app_private.platform_jobs from public;
revoke all on function app_private.actor_has_permission(text, text) from public;
revoke all on function app_private.policy_job_estimate(text, text, jsonb) from public;
revoke all on function app_private.enqueue_policy_job(text, text, jsonb, text) from public;
revoke all on function app_api.backend_estimate_category_policy_changes(text, jsonb, text[], boolean) from public;
revoke all on function app_api.backend_list_platform_jobs(text, integer) from public;
revoke all on function app_api.backend_process_platform_job_batch(integer) from public;
