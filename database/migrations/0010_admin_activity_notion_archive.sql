create or replace function app_private.queue_management_audit_notion_sync()
returns trigger
language plpgsql
security definer
set search_path to 'app_private', 'public'
as $$
declare
  audit jsonb := to_jsonb(new);
  notion_target_type text;
  notion_action text;
  notion_domain text;
  notion_target_id text;
  notion_detail jsonb;
begin
  case tg_table_name
    when 'admin_audit_log' then
      notion_target_type := 'admin-audit';
      notion_action := audit->>'action';
      notion_domain := audit->>'domain';
      notion_target_id := audit->>'target_id';
      notion_detail := coalesce(audit->'detail', '{}'::jsonb);
    when 'role_assignment_audit' then
      notion_target_type := 'role-audit';
      notion_action := 'role.' || coalesce(audit->>'operation', 'update');
      notion_domain := 'role';
      notion_target_id := audit->>'uid';
      notion_detail := jsonb_build_object(
        'operation', audit->>'operation',
        'roleCode', audit->>'role_code'
      );
    when 'category_configuration_audit' then
      notion_target_type := 'category-audit';
      notion_action := 'category.' || coalesce(audit->>'operation', 'update');
      notion_domain := audit->>'domain';
      notion_target_id := audit->>'category_id';
      notion_detail := jsonb_build_object(
        'after', audit->'after_value',
        'before', audit->'before_value'
      );
    when 'access_assignment_audit' then
      notion_target_type := 'access-audit';
      notion_action := 'access.update';
      notion_domain := 'access';
      notion_target_id := audit->>'target_uid';
      notion_detail := jsonb_build_object(
        'after', audit->'after_value',
        'before', audit->'before_value'
      );
    else
      raise exception 'unsupported management audit table: %', tg_table_name;
  end case;

  insert into app_private.outbox_events(
    event_type,
    target_type,
    target_id,
    actor_uid,
    payload
  ) values (
    'admin.audit_recorded',
    notion_target_type,
    new.id::text,
    audit->>'actor_uid',
    jsonb_build_object(
      'action', notion_action,
      'actor_uid', audit->>'actor_uid',
      'created_at', audit->>'created_at',
      'detail', notion_detail,
      'domain', notion_domain,
      'target_id', notion_target_id
    )
  );
  return new;
end;
$$;

create trigger admin_audit_notion_sync
after insert on app_private.admin_audit_log
for each row execute function app_private.queue_management_audit_notion_sync();

create trigger role_assignment_audit_notion_sync
after insert on app_private.role_assignment_audit
for each row execute function app_private.queue_management_audit_notion_sync();

create trigger category_configuration_audit_notion_sync
after insert on app_private.category_configuration_audit
for each row execute function app_private.queue_management_audit_notion_sync();

create trigger access_assignment_audit_notion_sync
after insert on app_private.access_assignment_audit
for each row execute function app_private.queue_management_audit_notion_sync();

insert into app_private.outbox_events(
  event_type,
  target_type,
  target_id,
  actor_uid,
  payload
)
select 'admin.audit_recorded', source.target_type, source.id::text, source.actor_uid, source.payload
from (
  select
    'admin-audit'::text target_type,
    audit.id,
    audit.actor_uid,
    jsonb_build_object(
      'action', audit.action,
      'actor_uid', audit.actor_uid,
      'created_at', audit.created_at,
      'detail', audit.detail,
      'domain', audit.domain,
      'target_id', audit.target_id
    ) payload
  from app_private.admin_audit_log audit
  where audit.created_at >= now() - interval '365 days'
  union all
  select
    'role-audit', audit.id, audit.actor_uid,
    jsonb_build_object(
      'action', 'role.' || audit.operation,
      'actor_uid', audit.actor_uid,
      'created_at', audit.created_at,
      'detail', jsonb_build_object('operation', audit.operation, 'roleCode', audit.role_code),
      'domain', 'role',
      'target_id', audit.uid
    )
  from app_private.role_assignment_audit audit
  where audit.created_at >= now() - interval '365 days'
  union all
  select
    'category-audit', audit.id, audit.actor_uid,
    jsonb_build_object(
      'action', 'category.' || audit.operation,
      'actor_uid', audit.actor_uid,
      'created_at', audit.created_at,
      'detail', jsonb_build_object('after', audit.after_value, 'before', audit.before_value),
      'domain', audit.domain,
      'target_id', audit.category_id
    )
  from app_private.category_configuration_audit audit
  where audit.created_at >= now() - interval '365 days'
  union all
  select
    'access-audit', audit.id, audit.actor_uid,
    jsonb_build_object(
      'action', 'access.update',
      'actor_uid', audit.actor_uid,
      'created_at', audit.created_at,
      'detail', jsonb_build_object('after', audit.after_value, 'before', audit.before_value),
      'domain', 'access',
      'target_id', audit.target_uid
    )
  from app_private.access_assignment_audit audit
  where audit.created_at >= now() - interval '365 days'
) source;

create function app_api.backend_list_admin_activity(
  window_hours integer default 24,
  before_occurred_at timestamptz default null,
  before_key text default null,
  page_limit integer default 100
)
returns jsonb
language sql
stable
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
  with settings as (
    select
      case
        when window_hours = 168 then 168
        when window_hours = 720 then 720
        else 24
      end hours,
      least(greatest(coalesce(page_limit, 100), 1), 100) limited_size
  ),
  activity as (
    select
      'registration'::text kind,
      profile.uid::text target_id,
      coalesce(profile.display_name, profile.email, profile.uid)::text title,
      profile.uid::text actor_uid,
      profile.created_at occurred_at,
      'registration:' || profile.uid activity_key
    from app_private.user_profiles profile
    union all
    select 'issue', issue.id::text, issue.title, issue.author_uid, issue.created_at,
      'issue:' || issue.id::text
    from app_private.issues issue
    union all
    select 'comment', comment.id::text, left(comment.content, 120), comment.author_uid,
      comment.created_at, 'comment:' || comment.id::text
    from app_private.comments comment
    union all
    select 'facility', facility.id::text, facility.title, facility.author_uid,
      facility.created_at, 'facility:' || facility.id::text
    from app_private.facility_reports facility
    union all
    select 'announcement', announcement.id::text, announcement.title,
      announcement.author_uid, announcement.published_at,
      'announcement:' || announcement.id::text
    from app_private.announcements announcement
    union all
    select 'comment', comment.id::text, left(comment.content, 120), comment.author_uid,
      comment.created_at, 'announcement-comment:' || comment.id::text
    from app_private.announcement_comments comment
    union all
    select 'admin', coalesce(audit.target_id, audit.id::text), audit.action,
      audit.actor_uid, audit.created_at, 'admin:' || audit.id::text
    from app_private.admin_audit_log audit
  ),
  matching as (
    select activity.*
    from activity, settings
    where activity.occurred_at >= now() - make_interval(hours => settings.hours)
      and (
        before_occurred_at is null
        or activity.occurred_at < before_occurred_at
        or (
          activity.occurred_at = before_occurred_at
          and activity.activity_key < coalesce(before_key, '')
        )
      )
    order by activity.occurred_at desc, activity.activity_key desc
    limit (select limited_size + 1 from settings)
  ),
  limited as (
    select * from matching
    order by occurred_at desc, activity_key desc
    limit (select limited_size from settings)
  ),
  last_entry as (
    select occurred_at, activity_key
    from limited
    order by occurred_at, activity_key
    limit 1
  )
  select jsonb_build_object(
    'entries', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'kind', kind,
          'target_id', target_id,
          'title', title,
          'actor_uid', actor_uid,
          'occurred_at', occurred_at
        ) order by occurred_at desc, activity_key desc
      ) from limited
    ), '[]'::jsonb),
    'nextCursor', case
      when (select count(*) from matching) > (select limited_size from settings)
      then (select jsonb_build_object(
        'occurredAt', occurred_at,
        'key', activity_key
      ) from last_entry)
      else null
    end
  );
$$;

create or replace function app_api.get_admin_overview(window_hours integer default 24)
returns jsonb
language sql
stable
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
  with settings as (
    select case
      when window_hours = 168 then 168
      when window_hours = 720 then 720
      else 24
    end hours
  ),
  threshold as (
    select now() - make_interval(hours => hours) since from settings
  ),
  user_stats as (
    select
      count(*)::bigint total_users,
      count(*) filter (where last_seen_at >= now() - interval '24 hours')::bigint active_24h,
      count(*) filter (where last_seen_at >= now() - interval '7 days')::bigint active_7d,
      count(*) filter (where last_seen_at >= now() - interval '30 days')::bigint active_30d,
      count(*) filter (where created_at >= (select since from threshold))::bigint new_users
    from app_private.user_profiles
  ),
  content_stats as (
    select
      (select count(*) from app_private.issues
        where created_at >= (select since from threshold))::bigint new_issues,
      (
        (select count(*) from app_private.comments
          where created_at >= (select since from threshold))
        + (select count(*) from app_private.announcement_comments
          where created_at >= (select since from threshold))
      )::bigint new_comments,
      (select count(*) from app_private.facility_reports
        where created_at >= (select since from threshold))::bigint new_facilities,
      (select count(*) from app_private.announcements
        where published_at >= (select since from threshold))::bigint new_announcements,
      (select count(*) from app_private.issues
        where status in ('under-review', 'pending', 'processing'))::bigint open_issues,
      (select count(*) from app_private.facility_reports
        where status in ('pending', 'processing'))::bigint open_facilities
  ),
  recent_activity as (
    select coalesce(
      app_api.backend_list_admin_activity(
        (select hours from settings),
        null,
        null,
        14
      )->'entries',
      '[]'::jsonb
    ) value
  )
  select jsonb_build_object(
    'windowHours', (select hours from settings),
    'totalUsers', user_stats.total_users,
    'activeUsers24h', user_stats.active_24h,
    'activeUsers7d', user_stats.active_7d,
    'activeUsers30d', user_stats.active_30d,
    'newUsers', user_stats.new_users,
    'newIssues', content_stats.new_issues,
    'newComments', content_stats.new_comments,
    'newFacilities', content_stats.new_facilities,
    'newAnnouncements', content_stats.new_announcements,
    'openIssues', content_stats.open_issues,
    'openFacilities', content_stats.open_facilities,
    'recentActivity', recent_activity.value
  )
  from user_stats, content_stats, recent_activity;
$$;

revoke all on function app_private.queue_management_audit_notion_sync() from public;
revoke all on function app_api.backend_list_admin_activity(integer, timestamptz, text, integer) from public;

do $$
declare
  definition text;
  insertion_point text :=
    '  cleanup_details := cleanup_details || jsonb_build_object(''admin_audit_log_deleted'', deleted_count);';
begin
  select pg_get_functiondef('app_private.run_maintenance_cleanup(text[], jsonb)'::regprocedure)
  into definition;

  definition := replace(
    definition,
    insertion_point,
    insertion_point || E'\n\n'
      || '  delete from app_private.notion_pages notion_page' || E'\n'
      || '  where (notion_page.target_type = ''admin-audit'' and not exists (' || E'\n'
      || '      select 1 from app_private.admin_audit_log audit' || E'\n'
      || '      where audit.id::text = notion_page.target_id' || E'\n'
      || '    )) or (notion_page.target_type = ''role-audit'' and not exists (' || E'\n'
      || '      select 1 from app_private.role_assignment_audit audit' || E'\n'
      || '      where audit.id::text = notion_page.target_id' || E'\n'
      || '    )) or (notion_page.target_type = ''category-audit'' and not exists (' || E'\n'
      || '      select 1 from app_private.category_configuration_audit audit' || E'\n'
      || '      where audit.id::text = notion_page.target_id' || E'\n'
      || '    )) or (notion_page.target_type = ''access-audit'' and not exists (' || E'\n'
      || '      select 1 from app_private.access_assignment_audit audit' || E'\n'
      || '      where audit.id::text = notion_page.target_id' || E'\n'
      || '    )) or (notion_page.target_type = ''announcement'' and not exists (' || E'\n'
      || '      select 1 from app_private.announcements announcement' || E'\n'
      || '      where announcement.id::text = notion_page.target_id' || E'\n'
      || '    ));' || E'\n'
      || '  get diagnostics deleted_count = row_count;' || E'\n'
      || '  cleanup_details := cleanup_details || jsonb_build_object(''orphaned_notion_mappings_deleted'', deleted_count);'
  );

  if position('orphaned_notion_mappings_deleted' in definition) = 0 then
    raise exception 'could not apply Notion mapping retention cleanup';
  end if;
  execute definition;
end;
$$;
