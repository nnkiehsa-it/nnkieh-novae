alter table app_private.user_profiles
  add column created_at timestamptz;

update app_private.user_profiles
set created_at = least(coalesce(last_seen_at, updated_at), updated_at);

alter table app_private.user_profiles
  alter column created_at set default now(),
  alter column created_at set not null;

create index user_profiles_created_at_idx
  on app_private.user_profiles (created_at desc);
create index user_profiles_last_seen_at_idx
  on app_private.user_profiles (last_seen_at desc nulls last);

create table app_private.user_restrictions (
  uid text primary key references app_private.user_profiles(uid) on delete cascade,
  restricted_until timestamptz,
  restricted_permanently boolean not null default false,
  reason text,
  updated_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_restrictions_reason_length
    check (char_length(coalesce(reason, '')) <= 500),
  constraint user_restrictions_state_check
    check (restricted_permanently or restricted_until is not null)
);

create table app_private.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_uid text not null,
  action text not null,
  domain text not null,
  target_id text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index admin_audit_log_created_at_idx
  on app_private.admin_audit_log (created_at desc, id desc);
create index admin_audit_log_actor_idx
  on app_private.admin_audit_log (actor_uid, created_at desc);
create index admin_audit_log_target_idx
  on app_private.admin_audit_log (target_id, created_at desc)
  where target_id is not null;

create or replace function app_api.backend_get_access_context(actor_uid text)
returns jsonb
language sql
stable
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
  with assigned_roles as (
    select role_code
    from app_private.user_role_assignments
    where uid = backend_get_access_context.actor_uid
  ),
  assigned_issue_categories as (
    select category_id
    from app_private.user_issue_category_assignments
    where uid = backend_get_access_context.actor_uid
  ),
  assigned_facility_categories as (
    select category_id
    from app_private.user_facility_category_assignments
    where uid = backend_get_access_context.actor_uid
  ),
  granted_permissions as (
    select distinct role_permission.permission_code
    from app_private.role_permissions role_permission
    join assigned_roles assigned_role
      on assigned_role.role_code = role_permission.role_code
  ),
  restriction as (
    select restricted_permanently, restricted_until
    from app_private.user_restrictions
    where uid = backend_get_access_context.actor_uid
  )
  select jsonb_build_object(
    'roles', coalesce(
      (select jsonb_agg(role_code order by role_code) from assigned_roles),
      '[]'::jsonb
    ),
    'managedIssueCategoryIds', coalesce(
      (select jsonb_agg(category_id order by category_id) from assigned_issue_categories),
      '[]'::jsonb
    ),
    'managedFacilityCategoryIds', coalesce(
      (select jsonb_agg(category_id order by category_id) from assigned_facility_categories),
      '[]'::jsonb
    ),
    'permissions', coalesce(
      (select jsonb_agg(permission_code order by permission_code) from granted_permissions),
      '[]'::jsonb
    ),
    'setupCompleted', coalesce(
      (select completed_at is not null from app_private.system_setup where singleton),
      false
    ),
    'interactionRestricted', coalesce(
      (
        select restricted_permanently
          or (restricted_until is not null and restricted_until > now())
        from restriction
      ),
      false
    )
  );
$$;

create function app_api.backend_list_admin_users(
  search_query text default '',
  page_limit integer default 80
)
returns jsonb
language sql
stable
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
  with settings as (
    select
      lower(btrim(coalesce(search_query, ''))) query,
      least(greatest(coalesce(page_limit, 80), 1), 100) limited_size
  ),
  rows as (
    select
      profile.uid,
      profile.email,
      profile.display_name,
      profile.created_at,
      profile.last_seen_at,
      restriction.restricted_until,
      coalesce(restriction.restricted_permanently, false) restricted_permanently,
      coalesce(restriction.reason, '') restriction_reason,
      coalesce((
        select jsonb_agg(assignment.role_code order by assignment.role_code)
        from app_private.user_role_assignments assignment
        where assignment.uid = profile.uid
      ), '[]'::jsonb) roles,
      coalesce((
        select jsonb_agg(assignment.category_id order by assignment.category_id)
        from app_private.user_issue_category_assignments assignment
        where assignment.uid = profile.uid
      ), '[]'::jsonb) managed_issue_category_ids,
      coalesce((
        select jsonb_agg(assignment.category_id order by assignment.category_id)
        from app_private.user_facility_category_assignments assignment
        where assignment.uid = profile.uid
      ), '[]'::jsonb) managed_facility_category_ids
    from app_private.user_profiles profile
    left join app_private.user_restrictions restriction on restriction.uid = profile.uid
    cross join settings
    where not exists (
      select 1
      from app_private.user_role_assignments assignment
      where assignment.uid = profile.uid and assignment.role_code = 'platform-admin'
    )
      and (
        settings.query = ''
        or lower(profile.uid) like '%' || settings.query || '%'
        or lower(coalesce(profile.email, '')) like '%' || settings.query || '%'
        or lower(coalesce(profile.display_name, '')) like '%' || settings.query || '%'
      )
    order by profile.last_seen_at desc nulls last, profile.created_at desc, profile.uid
    limit (select limited_size + 1 from settings)
  ),
  limited as (
    select * from rows limit (select limited_size from settings)
  )
  select jsonb_build_object(
    'truncated', (select count(*) from rows) > (select limited_size from settings),
    'users', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'uid', uid,
          'email', email,
          'name', coalesce(nullif(display_name, ''), email, uid),
          'createdAtMs', floor(extract(epoch from created_at) * 1000),
          'lastSeenAtMs', case
            when last_seen_at is null then null
            else floor(extract(epoch from last_seen_at) * 1000)
          end,
          'restrictedUntilMs', case
            when restricted_until is null then null
            else floor(extract(epoch from restricted_until) * 1000)
          end,
          'restrictedPermanently', restricted_permanently,
          'restrictionReason', restriction_reason,
          'roles', roles,
          'managedIssueCategoryIds', managed_issue_category_ids,
          'managedFacilityCategoryIds', managed_facility_category_ids
        )
        order by last_seen_at desc nulls last, created_at desc, uid
      )
      from limited
    ), '[]'::jsonb)
  );
$$;

create function app_api.backend_set_user_restriction(
  actor_uid text,
  target_uid text,
  restriction_mode text,
  reason text
)
returns jsonb
language plpgsql
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
declare
  normalized_reason text := nullif(btrim(coalesce(reason, '')), '');
  next_until timestamptz;
  permanent boolean := false;
begin
  if coalesce(btrim(actor_uid), '') = ''
    or coalesce(btrim(target_uid), '') = ''
    or restriction_mode not in ('clear', '7d', '30d', 'permanent')
  then
    raise exception 'validation-required';
  end if;
  if actor_uid = target_uid then raise exception 'permission-denied'; end if;
  if restriction_mode <> 'clear' and normalized_reason is null then
    raise exception 'validation-required';
  end if;
  if char_length(coalesce(normalized_reason, '')) > 500 then
    raise exception 'validation-invalid';
  end if;

  perform 1 from app_private.user_profiles where uid = target_uid for update;
  if not found then raise exception 'not-found'; end if;
  if exists (
    select 1 from app_private.user_role_assignments
    where uid = target_uid and role_code = 'platform-admin'
  ) then
    raise exception 'permission-denied';
  end if;

  if restriction_mode = 'clear' then
    delete from app_private.user_restrictions where uid = target_uid;
  else
    if restriction_mode = '7d' then
      next_until := now() + interval '7 days';
    elsif restriction_mode = '30d' then
      next_until := now() + interval '30 days';
    else
      permanent := true;
    end if;

    insert into app_private.user_restrictions(
      uid, restricted_until, restricted_permanently, reason, updated_by, updated_at
    ) values (
      target_uid, next_until, permanent, normalized_reason, actor_uid, now()
    )
    on conflict(uid) do update set
      restricted_until = excluded.restricted_until,
      restricted_permanently = excluded.restricted_permanently,
      reason = excluded.reason,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at;
  end if;

  insert into app_private.admin_audit_log(
    actor_uid, action, domain, target_id, detail
  ) values (
    actor_uid,
    'setUserRestriction',
    'user',
    target_uid,
    jsonb_build_object('mode', restriction_mode, 'reason', normalized_reason)
  );

  return jsonb_build_object(
    'success', true,
    'uid', target_uid,
    'restrictedUntilMs', case
      when next_until is null then null
      else floor(extract(epoch from next_until) * 1000)
    end,
    'restrictedPermanently', permanent
  );
end;
$$;

create function app_api.backend_list_admin_audit(
  search_query text default '',
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
      lower(btrim(coalesce(search_query, ''))) query,
      least(greatest(coalesce(page_limit, 100), 1), 200) limited_size
  ),
  rows as (
    select
      audit.id,
      audit.actor_uid,
      coalesce(actor.display_name, actor.email, audit.actor_uid) actor_name,
      audit.action,
      audit.domain,
      audit.target_id,
      audit.detail,
      audit.created_at
    from app_private.admin_audit_log audit
    left join app_private.user_profiles actor on actor.uid = audit.actor_uid
    cross join settings
    where settings.query = ''
      or lower(audit.actor_uid) like '%' || settings.query || '%'
      or lower(coalesce(actor.display_name, '')) like '%' || settings.query || '%'
      or lower(audit.action) like '%' || settings.query || '%'
      or lower(audit.domain) like '%' || settings.query || '%'
      or lower(coalesce(audit.target_id, '')) like '%' || settings.query || '%'
    order by audit.created_at desc, audit.id desc
    limit (select limited_size + 1 from settings)
  ),
  limited as (
    select * from rows limit (select limited_size from settings)
  )
  select jsonb_build_object(
    'truncated', (select count(*) from rows) > (select limited_size from settings),
    'entries', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', id,
          'actorUid', actor_uid,
          'actorName', actor_name,
          'action', action,
          'domain', domain,
          'targetId', target_id,
          'detail', detail,
          'createdAtMs', floor(extract(epoch from created_at) * 1000)
        )
        order by created_at desc, id desc
      )
      from limited
    ), '[]'::jsonb)
  );
$$;

create function app_api.get_admin_overview(window_hours integer default 24)
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
    select coalesce(jsonb_agg(to_jsonb(activity) order by occurred_at desc), '[]'::jsonb) value
    from (
      select * from (
        select
          'registration'::text kind,
          profile.uid::text target_id,
          coalesce(profile.display_name, profile.email, profile.uid)::text title,
          profile.uid::text actor_uid,
          profile.created_at occurred_at
        from app_private.user_profiles profile
        union all
        select 'issue', issue.id::text, issue.title, issue.author_uid, issue.created_at
        from app_private.issues issue
        union all
        select 'facility', facility.id::text, facility.title, facility.author_uid, facility.created_at
        from app_private.facility_reports facility
        union all
        select 'announcement', announcement.id::text, announcement.title,
          announcement.author_uid, announcement.published_at
        from app_private.announcements announcement
        union all
        select 'admin', coalesce(audit.target_id, audit.id::text), audit.action,
          audit.actor_uid, audit.created_at
        from app_private.admin_audit_log audit
      ) combined
      order by occurred_at desc
      limit 14
    ) activity
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

revoke all on app_private.user_restrictions from public;
revoke all on app_private.admin_audit_log from public;
revoke all on sequence app_private.admin_audit_log_id_seq from public;
revoke all on function app_api.backend_list_admin_users(text, integer) from public;
revoke all on function app_api.backend_set_user_restriction(text, text, text, text) from public;
revoke all on function app_api.backend_list_admin_audit(text, integer) from public;
revoke all on function app_api.get_admin_overview(integer) from public;
