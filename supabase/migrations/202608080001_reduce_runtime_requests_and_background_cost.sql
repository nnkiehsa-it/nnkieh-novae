-- Collapse hot read paths into one PostgREST request, throttle visit writes,
-- and keep background retry polling as a low-frequency safety net.

create function app_api.backend_get_session_bootstrap_snapshot(
  actor_uid text,
  actor_is_admin boolean,
  actor_email text,
  actor_name text,
  actor_photo_url text,
  record_visit boolean
)
returns jsonb
language plpgsql
security definer
set search_path = app_private, app_api, public
as $$
declare
  issue_categories jsonb;
  facility_categories jsonb;
  features jsonb;
  versions jsonb;
begin
  if coalesce(record_visit, false) then
    insert into app_private.user_profiles(
      uid, email, display_name, photo_url, last_seen_at, updated_at
    ) values (
      actor_uid, lower(actor_email), actor_name, actor_photo_url, now(), now()
    )
    on conflict (uid) do update set
      email = excluded.email,
      display_name = excluded.display_name,
      photo_url = excluded.photo_url,
      last_seen_at = case
        when user_profiles.last_seen_at is null
          or user_profiles.last_seen_at <= now() - interval '24 hours'
          then excluded.last_seen_at
        else user_profiles.last_seen_at
      end,
      updated_at = excluded.updated_at
    where user_profiles.email is distinct from excluded.email
      or user_profiles.display_name is distinct from excluded.display_name
      or user_profiles.photo_url is distinct from excluded.photo_url
      or user_profiles.last_seen_at is null
      or user_profiles.last_seen_at <= now() - interval '24 hours';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'authorVisible', category.author_visible,
    'commentsEnabled', category.comments_enabled,
    'id', category.id,
    'isDefault', category.is_default,
    'label', category.label,
    'readAccess', category.read_access,
    'responseDeadlineDays', category.response_deadline_days,
    'sortOrder', category.sort_order,
    'supportDeadlineDays', category.support_deadline_days,
    'supportEnabled', category.support_enabled,
    'supportGoal', category.support_goal
  ) order by category.sort_order, category.created_at, category.id), '[]'::jsonb)
  into issue_categories
  from app_private.issue_categories category;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', category.id,
    'isDefault', category.is_default,
    'label', category.label,
    'sortOrder', category.sort_order
  ) order by category.sort_order, category.created_at, category.id), '[]'::jsonb)
  into facility_categories
  from app_private.facility_categories category;

  select coalesce(jsonb_build_object(
    'announcementCommentsEnabled', setup.announcement_comments_enabled,
    'facilitiesEnabled', setup.facilities_enabled,
    'issuesEnabled', setup.issues_enabled
  ), jsonb_build_object(
    'announcementCommentsEnabled', true,
    'facilitiesEnabled', true,
    'issuesEnabled', true
  ))
  into features
  from app_private.system_setup setup
  where setup.singleton;

  if features is null then
    features := jsonb_build_object(
      'announcementCommentsEnabled', true,
      'facilitiesEnabled', true,
      'issuesEnabled', true
    );
  end if;

  select jsonb_build_object(
    'announcements', coalesce(max(version) filter (where domain = 'announcements'), 1),
    'facilities', coalesce(max(version) filter (where domain = 'facilities'), 1),
    'issues', coalesce(max(version) filter (where domain = 'issues'), 1)
  )
  into versions
  from app_private.content_versions;

  return jsonb_build_object(
    'catalog', jsonb_build_object(
      'issueCategories', issue_categories,
      'facilityCategories', facility_categories,
      'features', features
    ),
    'notificationUnread', app_api.backend_get_notification_unread_hint(actor_uid, actor_is_admin),
    'versions', versions,
    'visitRecorded', coalesce(record_visit, false)
  );
end;
$$;

create function app_api.backend_list_issues_snapshot(
  action_name text,
  actor_uid text,
  actor_can_manage boolean,
  active_filter text,
  status_bucket text,
  sort_name text,
  page_size integer,
  title_query text,
  cursor_id uuid,
  cursor_created_at timestamptz,
  cursor_sort_date timestamptz,
  cursor_sort_number integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = app_private, app_api, public
as $$
declare
  private_to_owner_categories text[];
  review_required_categories text[];
  author_private_categories text[];
  result jsonb;
  content_version bigint;
begin
  if not exists (
    select 1 from app_private.issue_categories category
    where category.id = active_filter and category.is_active
  ) then
    raise exception 'invalid-issue-category';
  end if;

  select
    coalesce(array_agg(id) filter (where read_access = 'owner-admin'), array[]::text[]),
    coalesce(array_agg(id) filter (where read_access = 'reviewed-school'), array[]::text[]),
    coalesce(array_agg(id) filter (where not author_visible), array[]::text[])
  into private_to_owner_categories, review_required_categories, author_private_categories
  from app_private.issue_categories;

  result := app_api.backend_list_issues(
    action_name, actor_uid, actor_can_manage, active_filter, status_bucket,
    sort_name, page_size, title_query, cursor_id, cursor_created_at,
    cursor_sort_date, cursor_sort_number, private_to_owner_categories,
    review_required_categories, author_private_categories
  );
  select version into content_version from app_private.content_versions where domain = 'issues';
  return coalesce(result, '{}'::jsonb) || jsonb_build_object('version', coalesce(content_version, 1));
end;
$$;

create function app_api.backend_list_user_issues_snapshot(
  actor_uid text,
  actor_is_admin boolean,
  status_bucket text,
  sort_name text,
  page_size integer,
  cursor_id uuid,
  cursor_created_at timestamptz,
  cursor_sort_date timestamptz,
  cursor_sort_number integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = app_private, app_api, public
as $$
declare
  private_to_owner_categories text[];
  review_required_categories text[];
  author_private_categories text[];
  result jsonb;
  content_version bigint;
begin
  select
    coalesce(array_agg(id) filter (where read_access = 'owner-admin'), array[]::text[]),
    coalesce(array_agg(id) filter (where read_access = 'reviewed-school'), array[]::text[]),
    coalesce(array_agg(id) filter (where not author_visible), array[]::text[])
  into private_to_owner_categories, review_required_categories, author_private_categories
  from app_private.issue_categories;

  result := app_api.backend_list_user_issues(
    actor_uid, actor_is_admin, status_bucket, sort_name, page_size, cursor_id,
    cursor_created_at, cursor_sort_date, cursor_sort_number,
    private_to_owner_categories, review_required_categories, author_private_categories
  );
  select version into content_version from app_private.content_versions where domain = 'issues';
  return coalesce(result, '{}'::jsonb) || jsonb_build_object('version', coalesce(content_version, 1));
end;
$$;

create function app_api.backend_list_facilities_snapshot(
  actor_uid text,
  actor_is_admin boolean,
  managed_category_ids text[],
  category_filter text,
  bucket text,
  status_filter text,
  search_query text,
  sort_name text,
  cursor_created_at timestamptz,
  cursor_number integer,
  cursor_id uuid,
  page_size integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = app_private, app_api, public
as $$
declare
  result jsonb;
  content_version bigint;
begin
  result := app_api.backend_list_facilities(
    actor_uid, actor_is_admin, managed_category_ids, category_filter, bucket,
    status_filter, search_query, sort_name, cursor_created_at, cursor_number,
    cursor_id, page_size
  );
  select version into content_version from app_private.content_versions where domain = 'facilities';
  return coalesce(result, '{}'::jsonb) || jsonb_build_object('version', coalesce(content_version, 1));
end;
$$;

create function app_api.backend_list_announcements_snapshot(
  actor_uid text,
  page_size integer,
  cursor_id uuid,
  cursor_published_at timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path = app_private, app_api, public
as $$
  select coalesce(app_api.backend_list_announcements(
    actor_uid, page_size, cursor_id, cursor_published_at
  ), '{}'::jsonb) || jsonb_build_object(
    'version', coalesce((
      select version from app_private.content_versions where domain = 'announcements'
    ), 1)
  );
$$;

create function app_api.run_scheduled_maintenance_cleanup(retention_config jsonb)
returns jsonb
language plpgsql
security definer
set search_path = app_private, app_api, public
as $$
declare
  result jsonb;
begin
  result := app_private.run_maintenance_cleanup(
    coalesce((
      select array_agg(category.id order by category.id)
      from app_private.issue_categories category
    ), array[]::text[]),
    coalesce(retention_config, '{}'::jsonb)
  );
  return jsonb_build_object(
    'result', result,
    'dueWorkers', jsonb_build_object(
      'outbox', exists (
        select 1 from app_private.outbox_events event
        where event.attempt_count < 8
          and (
            (event.status in ('pending', 'failed') and event.next_attempt_at <= now())
            or (event.status = 'processing' and event.locked_at < now() - interval '10 minutes')
          )
      ),
      'deletion', exists (
        select 1 from app_private.deletion_jobs job
        where job.attempt_count < 8
          and (
            (job.status in ('pending', 'failed') and job.next_attempt_at <= now())
            or (job.status = 'processing' and job.locked_at < now() - interval '10 minutes')
          )
      )
    )
  );
end;
$$;

revoke all on function app_api.backend_get_session_bootstrap_snapshot(text,boolean,text,text,text,boolean)
from public, anon, authenticated;
revoke all on function app_api.backend_list_issues_snapshot(
  text,text,boolean,text,text,text,integer,text,uuid,timestamptz,timestamptz,integer
) from public, anon, authenticated;
revoke all on function app_api.backend_list_user_issues_snapshot(
  text,boolean,text,text,integer,uuid,timestamptz,timestamptz,integer
) from public, anon, authenticated;
revoke all on function app_api.backend_list_facilities_snapshot(
  text,boolean,text[],text,text,text,text,text,timestamptz,integer,uuid,integer
) from public, anon, authenticated;
revoke all on function app_api.backend_list_announcements_snapshot(text,integer,uuid,timestamptz)
from public, anon, authenticated;
revoke all on function app_api.run_scheduled_maintenance_cleanup(jsonb)
from public, anon, authenticated;

grant execute on function app_api.backend_get_session_bootstrap_snapshot(text,boolean,text,text,text,boolean)
to service_role;
grant execute on function app_api.backend_list_issues_snapshot(
  text,text,boolean,text,text,text,integer,text,uuid,timestamptz,timestamptz,integer
) to service_role;
grant execute on function app_api.backend_list_user_issues_snapshot(
  text,boolean,text,text,integer,uuid,timestamptz,timestamptz,integer
) to service_role;
grant execute on function app_api.backend_list_facilities_snapshot(
  text,boolean,text[],text,text,text,text,text,timestamptz,integer,uuid,integer
) to service_role;
grant execute on function app_api.backend_list_announcements_snapshot(text,integer,uuid,timestamptz)
to service_role;
grant execute on function app_api.run_scheduled_maintenance_cleanup(jsonb)
to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'srp_retry_background_workers';
    perform cron.schedule(
      'srp_retry_background_workers',
      '*/5 * * * *',
      'select app_private.signal_due_background_workers();'
    );
  end if;
end $$;
