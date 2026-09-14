-- The overview's figures open onto the activity they count.
--
-- `app_api.get_admin_overview` asked `backend_list_admin_activity` for fourteen
-- entries, which was enough while the screen only listed "recent activity"
-- underneath the figures. Each figure for the period is a drawer onto its own
-- share of that activity now, so fourteen entries shared between registrations,
-- proposals, comments and facility reports leaves a figure of forty opening
-- onto three rows — or, when another kind fills the fourteen, onto nothing at
-- all. It asks for the most the function will give, which is a hundred; the
-- screen says so when a figure still counts more than it can show.

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
        100
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
