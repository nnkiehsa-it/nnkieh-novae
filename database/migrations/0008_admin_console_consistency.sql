create or replace function app_api.backend_list_admin_users(
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
  matching_profiles as (
    select
      profile.uid,
      profile.email,
      profile.display_name,
      profile.created_at,
      profile.last_seen_at,
      restriction.restricted_until,
      coalesce(restriction.restricted_permanently, false) restricted_permanently,
      coalesce(restriction.reason, '') restriction_reason
    from app_private.user_profiles profile
    left join app_private.user_restrictions restriction on restriction.uid = profile.uid
    cross join settings
    where settings.query = ''
      or lower(profile.uid) like '%' || settings.query || '%'
      or lower(coalesce(profile.email, '')) like '%' || settings.query || '%'
      or lower(coalesce(profile.display_name, '')) like '%' || settings.query || '%'
  ),
  limited_profiles as (
    select *
    from matching_profiles
    order by last_seen_at desc nulls last, created_at desc, uid
    limit (select limited_size from settings)
  ),
  rows as (
    select
      profile.*,
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
    from limited_profiles profile
  )
  select jsonb_build_object(
    'truncated', (select count(*) from matching_profiles) > (select limited_size from settings),
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
      from rows
    ), '[]'::jsonb)
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
    select coalesce(jsonb_agg(to_jsonb(activity) order by occurred_at desc), '[]'::jsonb) value
    from (
      select *
      from (
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
      where combined.occurred_at >= (select since from threshold)
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

do $$
declare
  definition text;
  insertion_point text :=
    '  cleanup_details := cleanup_details || jsonb_build_object(''role_assignment_audit_deleted'', deleted_count);';
begin
  select pg_get_functiondef('app_private.run_maintenance_cleanup(text[], jsonb)'::regprocedure)
  into definition;

  definition := replace(
    definition,
    insertion_point,
    insertion_point || E'\n\n'
      || '  delete from app_private.admin_audit_log' || E'\n'
      || '  where created_at < now() - make_interval(days => role_audit_days);' || E'\n'
      || '  get diagnostics deleted_count = row_count;' || E'\n'
      || '  cleanup_details := cleanup_details || jsonb_build_object(''admin_audit_log_deleted'', deleted_count);'
  );

  if position('admin_audit_log_deleted' in definition) = 0 then
    raise exception 'could not apply admin audit retention cleanup';
  end if;
  execute definition;
end;
$$;
