-- Reduce steady-state Edge round trips and add indexes/deduplication for
-- resource-sensitive background and search paths.

create or replace function app_api.backend_get_access_context(actor_uid text)
returns jsonb
language sql
stable
security definer
set search_path = app_private, app_api, public
as $$
  with assigned_roles as (
    select role_code
    from app_private.user_role_assignments
    where uid = backend_get_access_context.actor_uid
  ), assigned_categories as (
    select category_id
    from app_private.user_issue_category_assignments
    where uid = backend_get_access_context.actor_uid
  ), granted_permissions as (
    select distinct role_permission.permission_code
    from app_private.role_permissions role_permission
    join assigned_roles assigned_role
      on assigned_role.role_code = role_permission.role_code
  )
  select jsonb_build_object(
    'roles',
    coalesce((select jsonb_agg(role_code order by role_code) from assigned_roles), '[]'::jsonb),
    'managedIssueCategoryIds',
    coalesce((select jsonb_agg(category_id order by category_id) from assigned_categories), '[]'::jsonb),
    'permissions',
    coalesce((select jsonb_agg(permission_code order by permission_code) from granted_permissions), '[]'::jsonb)
  );
$$;

revoke all on function app_api.backend_get_access_context(text) from public, anon, authenticated;
grant execute on function app_api.backend_get_access_context(text) to service_role;

create or replace function app_api.backend_list_issues(
  action_name text,
  actor_uid text,
  actor_is_admin boolean,
  active_filter text,
  status_bucket text,
  sort_name text,
  page_size integer,
  title_query text,
  cursor_id uuid,
  cursor_created_at timestamptz,
  cursor_sort_date timestamptz,
  cursor_sort_number integer,
  private_to_owner_categories text[],
  review_required_categories text[],
  author_private_categories text[]
)
returns jsonb
language plpgsql
stable
security definer
set search_path = app_private, app_api, public
as $$
declare
  effective_sort_name text := case
    when coalesce(status_bucket, 'active') = 'closed' then 'latest'
    else coalesce(sort_name, 'latest')
  end;
  limited_page_size integer := least(greatest(coalesce(page_size, 30), 1), 50);
  rows_json jsonb := '[]'::jsonb;
  last_issue jsonb;
  page_row record;
begin
  for page_row in
    select
      issue_record,
      exists (
        select 1
        from app_private.supports support
        where support.issue_id = issue_record.id
          and support.uid = actor_uid
      ) as current_user_supported
    from app_private.issues issue_record
    where issue_record.category = active_filter
      and (
        actor_is_admin
        or issue_record.author_uid = actor_uid
        or issue_record.category <> all(private_to_owner_categories)
      )
      and (
        actor_is_admin
        or issue_record.author_uid = actor_uid
        or not (
          issue_record.category = any(review_required_categories)
          and issue_record.status in ('under-review', 'review-rejected')
        )
      )
      and (
        case
          when coalesce(status_bucket, 'active') = 'closed' then
            case
              when actor_is_admin or issue_record.category = any(private_to_owner_categories)
                then issue_record.status in ('auto-rejected', 'review-rejected', 'infeasible', 'completed')
              else issue_record.status in ('auto-rejected', 'infeasible', 'completed')
                or (issue_record.author_uid = actor_uid and issue_record.status = 'review-rejected')
            end
          else
            case
              when actor_is_admin or issue_record.category = any(private_to_owner_categories)
                then issue_record.status in ('under-review', 'pending', 'processing')
              else issue_record.status in ('pending', 'processing')
                or (issue_record.author_uid = actor_uid and issue_record.status = 'under-review')
            end
        end
      )
      and (
        action_name <> 'searchIssues'
        or issue_record.title_search ilike (
          '%' || replace(replace(replace(lower(coalesce(title_query, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%'
        ) escape '\'
      )
      and (
        cursor_id is null
        or case
          when effective_sort_name = 'most-supported' and cursor_sort_number is not null then
            issue_record.support_count < cursor_sort_number
            or (
              issue_record.support_count = cursor_sort_number
              and app_private.issue_list_sort_date(issue_record, status_bucket, effective_sort_name)
                < coalesce(cursor_sort_date, cursor_created_at)
            )
            or (
              issue_record.support_count = cursor_sort_number
              and app_private.issue_list_sort_date(issue_record, status_bucket, effective_sort_name)
                = coalesce(cursor_sort_date, cursor_created_at)
              and issue_record.id < cursor_id
            )
          when effective_sort_name = 'ending-soon' and cursor_sort_date is not null then
            issue_record.support_deadline_at > cursor_sort_date
            or (
              issue_record.support_deadline_at = cursor_sort_date
              and issue_record.created_at < cursor_created_at
            )
            or (
              issue_record.support_deadline_at = cursor_sort_date
              and issue_record.created_at = cursor_created_at
              and issue_record.id < cursor_id
            )
          when effective_sort_name = 'ending-soon' and cursor_sort_date is null then
            issue_record.support_deadline_at is null
            and (
              issue_record.created_at < cursor_created_at
              or (issue_record.created_at = cursor_created_at and issue_record.id < cursor_id)
            )
          else
            app_private.issue_list_sort_date(issue_record, status_bucket, effective_sort_name)
              < coalesce(cursor_sort_date, cursor_created_at)
            or (
              app_private.issue_list_sort_date(issue_record, status_bucket, effective_sort_name)
                = coalesce(cursor_sort_date, cursor_created_at)
              and issue_record.id < cursor_id
            )
        end
      )
    order by
      case when effective_sort_name = 'most-supported' then issue_record.support_count end desc,
      case when effective_sort_name = 'ending-soon' then issue_record.support_deadline_at end asc nulls last,
      case when effective_sort_name = 'ending-soon' then issue_record.created_at end desc,
      case when effective_sort_name <> 'ending-soon'
        then app_private.issue_list_sort_date(issue_record, status_bucket, effective_sort_name)
      end desc,
      issue_record.id desc
    limit limited_page_size + 1
  loop
    rows_json := rows_json || jsonb_build_array(app_api.backend_issue_list_to_json(
      page_row.issue_record,
      actor_uid,
      actor_is_admin,
      page_row.current_user_supported,
      private_to_owner_categories,
      review_required_categories,
      author_private_categories
    ));
  end loop;

  last_issue := rows_json -> (limited_page_size - 1);
  return jsonb_build_object(
    'issues', (
      select coalesce(jsonb_agg(value), '[]'::jsonb)
      from (
        select value
        from jsonb_array_elements(rows_json) with ordinality as items(value, position)
        where position <= limited_page_size
        order by position
      ) limited_rows
    ),
    'hasMore', jsonb_array_length(rows_json) > limited_page_size,
    'limited', jsonb_array_length(rows_json) > limited_page_size,
    'cursor', case
      when jsonb_array_length(rows_json) > limited_page_size and last_issue is not null then
        jsonb_build_object(
          'id', last_issue ->> 'id',
          'created_at', last_issue -> 'created_at_ms',
          'sort_date', case
            when effective_sort_name = 'ending-soon' then last_issue -> 'support_deadline_at_ms'
            when coalesce(status_bucket, 'active') = 'closed'
              then coalesce(last_issue -> 'closed_at_ms', last_issue -> 'created_at_ms')
            else coalesce(last_issue -> 'review_approved_at_ms', last_issue -> 'created_at_ms')
          end,
          'sort_number', case
            when effective_sort_name = 'most-supported' then last_issue -> 'support_count'
            else null
          end
        )
      else null
    end
  );
end;
$$;

revoke all on function app_api.backend_list_issues(
  text,text,boolean,text,text,text,integer,text,uuid,timestamptz,timestamptz,integer,text[],text[],text[]
) from public, anon, authenticated;
grant execute on function app_api.backend_list_issues(
  text,text,boolean,text,text,text,integer,text,uuid,timestamptz,timestamptz,integer,text[],text[],text[]
) to service_role;

create or replace function app_api.sync_runtime_settings(settings jsonb)
returns void
language sql
security definer
set search_path = app_private, app_api, public
as $$
  insert into app_private.runtime_settings(key, value, updated_at)
  select setting.key, setting.value, now()
  from jsonb_each_text(coalesce(sync_runtime_settings.settings, '{}'::jsonb)) setting
  on conflict (key) do update
  set value = excluded.value,
      updated_at = excluded.updated_at
  where app_private.runtime_settings.value is distinct from excluded.value;
$$;

revoke all on function app_api.sync_runtime_settings(jsonb) from public, anon, authenticated;
grant execute on function app_api.sync_runtime_settings(jsonb) to service_role;

create index if not exists facility_reports_title_search_trgm_idx
  on app_private.facility_reports using gin (title_search extensions.gin_trgm_ops);

create index if not exists facility_reports_location_search_trgm_idx
  on app_private.facility_reports using gin (lower(location) extensions.gin_trgm_ops);

create index if not exists outbox_events_stale_processing_idx
  on app_private.outbox_events (locked_at)
  where status = 'processing' and attempt_count < 8;

create index if not exists deletion_jobs_stale_processing_idx
  on app_private.deletion_jobs (locked_at)
  where status = 'processing' and attempt_count < 8;

-- Broadcast replaced the legacy row-backed realtime feed. Keep an empty
-- compatibility shell until the retention RPC is next versioned, but remove
-- all retained rows and indexes so it has effectively no storage cost.
truncate table app_private.realtime_events;
drop index if exists app_private.realtime_events_created_idx;
drop index if exists app_private.realtime_events_expires_idx;
drop index if exists app_private.realtime_events_recipient_idx;

with duplicate_jobs as (
  select id,
    row_number() over (
      partition by cloudinary_public_id
      order by created_at, id
    ) as duplicate_number
  from app_private.deletion_jobs
  where cloudinary_public_id is not null
    and status in ('pending', 'processing', 'failed')
)
delete from app_private.deletion_jobs deletion_job
using duplicate_jobs duplicate_job
where deletion_job.id = duplicate_job.id
  and duplicate_job.duplicate_number > 1;

create or replace function app_private.skip_duplicate_active_deletion_job()
returns trigger
language plpgsql
as $$
begin
  if new.cloudinary_public_id is null then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(new.cloudinary_public_id, 0));
  if exists (
    select 1
    from app_private.deletion_jobs
    where cloudinary_public_id = new.cloudinary_public_id
      and status in ('pending', 'processing', 'failed')
  ) then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists skip_duplicate_active_deletion_job on app_private.deletion_jobs;
create trigger skip_duplicate_active_deletion_job
before insert on app_private.deletion_jobs
for each row execute function app_private.skip_duplicate_active_deletion_job();

create unique index if not exists deletion_jobs_active_cloudinary_unique_idx
  on app_private.deletion_jobs (cloudinary_public_id)
  where cloudinary_public_id is not null
    and status in ('pending', 'processing', 'failed');

alter table app_private.notion_pages
  add column if not exists content_hash text;

create or replace function app_private.skip_identical_outbox_update()
returns trigger
language plpgsql
as $$
begin
  if new is not distinct from old then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists skip_identical_outbox_update on app_private.outbox_events;
create trigger skip_identical_outbox_update
before update on app_private.outbox_events
for each row execute function app_private.skip_identical_outbox_update();

revoke all on function app_private.skip_identical_outbox_update()
  from public, anon, authenticated;
revoke all on function app_private.skip_duplicate_active_deletion_job()
  from public, anon, authenticated;
