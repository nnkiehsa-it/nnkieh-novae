-- The last answers that still left the database snake_case, or with instants
-- as millisecond numbers, now leave in the shape the API answers with (see
-- 0062 and 0063). The Worker used to rename every key on the way out, which
-- hid these; it no longer does.

create or replace function app_api.backend_list_admin_activity(
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
          'targetId', target_id,
          'title', title,
          'actorUid', actor_uid,
          'occurredAt', occurred_at
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


create or replace function app_api.backend_list_admin_audit(search_query text default '', page_limit integer default 100, page_offset integer default 0)
returns jsonb language sql stable security definer set search_path to 'app_private', 'public' as $$
with rows as (
  select a.id, a.actor_uid, coalesce(p.display_name, p.email, a.actor_uid) actor_name, a.action, a.domain, a.target_id, a.detail, a.created_at
  from app_private.admin_audit_log a left join app_private.user_profiles p on p.uid = a.actor_uid
  where search_query = '' or a.actor_uid ilike '%' || search_query || '%' or p.display_name ilike '%' || search_query || '%'
    or a.action ilike '%' || search_query || '%' or a.domain ilike '%' || search_query || '%' or a.target_id ilike '%' || search_query || '%'
  order by a.id desc limit least(greatest(page_limit, 1), 100) + 1 offset greatest(page_offset, 0)
), limited as (select * from rows order by id desc limit least(greatest(page_limit, 1), 100))
select jsonb_build_object(
  'truncated', (select count(*) from rows) > least(greatest(page_limit, 1), 100),
  'entries', coalesce((select jsonb_agg(jsonb_build_object(
    'id', id,
    'actorUid', actor_uid,
    'actorName', actor_name,
    'action', action,
    'domain', domain,
    'targetId', target_id,
    'detail', detail,
    'createdAt', created_at
  ) order by id desc) from limited), '[]'::jsonb)
);
$$;

CREATE OR REPLACE FUNCTION app_api.backend_mark_notifications_opened(
  actor_uid text,
  opened_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'app_private', 'app_api', 'public'
AS $function$
declare
  saved_opened_at timestamptz;
begin
  insert into app_private.notification_states
    (uid, admin_opened_at, broadcast_opened_at, user_opened_at, updated_at)
  values (actor_uid, opened_at, opened_at, opened_at, opened_at)
  on conflict (uid) do update set
    admin_opened_at = greatest(notification_states.admin_opened_at, excluded.admin_opened_at),
    broadcast_opened_at = greatest(notification_states.broadcast_opened_at, excluded.broadcast_opened_at),
    user_opened_at = greatest(notification_states.user_opened_at, excluded.user_opened_at),
    updated_at = greatest(notification_states.updated_at, excluded.updated_at)
  returning greatest(admin_opened_at, broadcast_opened_at, user_opened_at)
  into saved_opened_at;

  return jsonb_build_object(
    'success', true,
    'openedAt', saved_opened_at
  );
end;
$function$;

