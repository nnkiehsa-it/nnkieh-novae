alter table app_private.push_tokens
  add column last_confirmed_at timestamptz not null default now();

create index push_tokens_last_confirmed_at_idx
  on app_private.push_tokens (last_confirmed_at);

alter table app_private.user_profiles
  alter column display_name drop not null;

update app_private.runtime_settings
set value = (
  coalesce(nullif(value, '')::jsonb, '{}'::jsonb)
  || jsonb_build_object(
    'closedIssuesDays', 365,
    'closedFacilitiesDays', 365
  )
)::text,
updated_at = now()
where key = 'data_retention_settings';

create or replace function app_api.backend_register_push_token(
  actor_uid text,
  device_id text,
  token text,
  permission text,
  platform text,
  user_agent text
)
returns jsonb
language plpgsql
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
declare
  max_devices constant integer := 10;
begin
  perform pg_advisory_xact_lock(hashtextextended(actor_uid, 0));
  perform pg_advisory_xact_lock(hashtextextended(token, 1));

  delete from app_private.push_tokens push_token
  where push_token.token = backend_register_push_token.token
    and (
      push_token.uid <> backend_register_push_token.actor_uid
      or push_token.device_id <> backend_register_push_token.device_id
    );

  if not exists (
    select 1 from app_private.push_tokens push_token
    where push_token.uid = actor_uid and push_token.device_id = backend_register_push_token.device_id
  ) and (
    select count(*) from app_private.push_tokens push_token where push_token.uid = actor_uid
  ) >= max_devices then
    raise exception 'push-token-limit-reached';
  end if;

  insert into app_private.push_tokens(
    uid, device_id, token, permission, platform, user_agent, last_confirmed_at, updated_at
  ) values (
    actor_uid, device_id, token, coalesce(permission, 'default'), platform, user_agent, now(), now()
  )
  on conflict on constraint push_tokens_pkey do update
  set token = excluded.token,
      permission = excluded.permission,
      platform = excluded.platform,
      user_agent = excluded.user_agent,
      last_confirmed_at = excluded.last_confirmed_at,
      updated_at = excluded.updated_at;

  return app_api.backend_push_notification_preference(actor_uid, device_id, permission);
end;
$$;

create or replace function app_private.run_maintenance_cleanup(
  valid_issue_categories text[] default null::text[],
  retention_config jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'app_private', 'public'
as $$
declare
  cleanup_details jsonb := '{}'::jsonb;
  deleted_count integer := 0;
  queued_count integer := 0;
  failed_deletion_jobs integer := 0;
  failure_trace_id uuid;
  run_id uuid;
  run_status text := 'success';
  closed_issue_cleanup_enabled boolean := coalesce((retention_config->>'closedIssuesEnabled')::boolean, true);
  closed_facility_cleanup_enabled boolean := coalesce((retention_config->>'closedFacilitiesEnabled')::boolean, true);
  closed_issue_days integer := greatest(1, least(3650, coalesce((retention_config->>'closedIssuesDays')::integer, 365)));
  closed_facility_days integer := greatest(1, least(3650, coalesce((retention_config->>'closedFacilitiesDays')::integer, 365)));
  announcement_days integer := greatest(1, least(3650, coalesce((retention_config->>'announcementsDays')::integer, 730)));
  notifications_days integer := greatest(1, least(3650, coalesce((retention_config->>'notificationsDays')::integer, 30)));
  realtime_hours integer := greatest(1, least(87600, coalesce((retention_config->>'realtimeEventsHours')::integer, 3)));
  outbox_completed_days integer := greatest(1, least(3650, coalesce((retention_config->>'outboxCompletedDays')::integer, 3)));
  outbox_failed_days integer := greatest(1, least(3650, coalesce((retention_config->>'outboxFailedDays')::integer, 14)));
  push_sent_days integer := greatest(1, least(3650, coalesce((retention_config->>'pushDeliverySentDays')::integer, 1)));
  push_failed_days integer := greatest(1, least(3650, coalesce((retention_config->>'pushDeliveryFailedDays')::integer, 7)));
  idempotency_hours integer := greatest(1, least(87600, coalesce((retention_config->>'idempotencyHours')::integer, 24)));
  inactive_push_token_days integer := greatest(1, least(3650, coalesce((retention_config->>'inactivePushTokensDays')::integer, 60)));
  inactive_avatar_days integer := greatest(1, least(3650, coalesce((retention_config->>'inactiveAvatarsDays')::integer, 180)));
  inactive_profile_pii_days integer := greatest(1, least(3650, coalesce((retention_config->>'inactiveProfilePiiDays')::integer, 365)));
  expired_restriction_days integer := greatest(1, least(3650, coalesce((retention_config->>'expiredRestrictionsDays')::integer, 30)));
  deletion_completed_days integer := greatest(1, least(3650, coalesce((retention_config->>'deletionJobCompletedDays')::integer, 3)));
  deletion_failed_days integer := greatest(1, least(3650, coalesce((retention_config->>'deletionJobFailedDays')::integer, 30)));
  maintenance_days integer := greatest(1, least(3650, coalesce((retention_config->>'maintenanceRunsDays')::integer, 30)));
  role_audit_days integer := greatest(1, least(3650, coalesce((retention_config->>'roleAssignmentAuditDays')::integer, 365)));
  category_audit_days integer := greatest(1, least(3650, coalesce((retention_config->>'categoryConfigurationAuditDays')::integer, 365)));
  access_audit_days integer := greatest(1, least(3650, coalesce((retention_config->>'accessAssignmentAuditDays')::integer, 365)));
  pending_upload_hours integer := greatest(1, least(87600, coalesce((retention_config->>'pendingUploadHours')::integer, 24)));
  unattached_upload_hours integer := greatest(1, least(87600, coalesce((retention_config->>'unattachedUploadHours')::integer, 48)));
  failed_upload_hours integer := greatest(1, least(87600, coalesce((retention_config->>'failedUploadHours')::integer, 24)));
begin
  insert into app_private.maintenance_runs(task_name, status, started_at)
  values ('maintenance.cleanup', 'running', now()) returning id into run_id;

  if valid_issue_categories is not null and array_length(valid_issue_categories, 1) > 0 then
    with removed_issues as materialized (
      select id, author_uid, category, title from app_private.issues
      where not (category = any(valid_issue_categories))
    ), queued_events as (
      insert into app_private.outbox_events(event_type, target_type, target_id, actor_uid, payload)
      select 'issue.deleted', 'issue', id::text, author_uid,
        jsonb_build_object('author_uid', author_uid, 'issue_category', category, 'issue_id', id, 'title', title)
      from removed_issues returning 1
    ), deleted_issues as (
      delete from app_private.issues where id in (select id from removed_issues) returning 1
    )
    select (select count(*) from deleted_issues), (select count(*) from queued_events)
    into deleted_count, queued_count;
    cleanup_details := cleanup_details || jsonb_build_object(
      'removed_category_issues_deleted', deleted_count,
      'removed_category_deletion_events_queued', queued_count
    );
  else
    cleanup_details := cleanup_details || jsonb_build_object(
      'removed_category_issues_deleted', 0,
      'removed_category_deletion_events_queued', 0
    );
  end if;

  with expired_issues as materialized (
    select id, author_uid, category, title from app_private.issues
    where closed_issue_cleanup_enabled
      and status in ('auto-rejected', 'review-rejected', 'infeasible', 'completed')
      and closed_at < now() - make_interval(days => closed_issue_days)
  ), queued_events as (
    insert into app_private.outbox_events(event_type, target_type, target_id, actor_uid, payload)
    select 'issue.deleted', 'issue', issue.id::text, issue.author_uid,
      jsonb_build_object(
        'author_uid', issue.author_uid,
        'issue_category', issue.category,
        'issue_id', issue.id,
        'retention_cleanup', true,
        'title', issue.title
      )
    from expired_issues issue
    where exists (
      select 1 from app_private.notion_pages notion_page
      where notion_page.target_type = 'issue' and notion_page.target_id = issue.id::text
    ) returning 1
  ), deleted_issues as (
    delete from app_private.issues where id in (select id from expired_issues) returning 1
  )
  select (select count(*) from deleted_issues), (select count(*) from queued_events)
  into deleted_count, queued_count;
  cleanup_details := cleanup_details || jsonb_build_object(
    'expired_closed_issues_deleted', deleted_count,
    'expired_closed_issue_notion_deletions_queued', queued_count
  );

  with expired_facilities as materialized (
    select id, author_uid, title from app_private.facility_reports
    where closed_facility_cleanup_enabled
      and status in ('completed', 'unable-to-handle')
      and closed_at < now() - make_interval(days => closed_facility_days)
  ), queued_events as (
    insert into app_private.outbox_events(event_type, target_type, target_id, actor_uid, payload)
    select 'facility.deleted', 'facility', facility.id::text, facility.author_uid,
      jsonb_build_object(
        'author_uid', facility.author_uid,
        'retention_cleanup', true,
        'title', facility.title
      )
    from expired_facilities facility
    where exists (
      select 1 from app_private.notion_pages notion_page
      where notion_page.target_type = 'facility' and notion_page.target_id = facility.id::text
    ) returning 1
  ), deleted_facilities as (
    delete from app_private.facility_reports where id in (select id from expired_facilities) returning 1
  )
  select (select count(*) from deleted_facilities), (select count(*) from queued_events)
  into deleted_count, queued_count;
  cleanup_details := cleanup_details || jsonb_build_object(
    'expired_closed_facilities_deleted', deleted_count,
    'expired_closed_facility_notion_deletions_queued', queued_count
  );

  delete from app_private.announcements
  where published_at < now() - make_interval(days => announcement_days);
  get diagnostics deleted_count = row_count;
  cleanup_details := cleanup_details || jsonb_build_object('expired_announcements_deleted', deleted_count);

  with stale_uploads as materialized (
    select id, cloudinary_public_id from app_private.uploads
    where cloudinary_public_id is not null and (
      (status = 'pending' and created_at < now() - make_interval(hours => pending_upload_hours))
      or (status = 'ready' and attached_target_id is null and updated_at < now() - make_interval(hours => unattached_upload_hours))
      or (status = 'failed' and updated_at < now() - make_interval(hours => failed_upload_hours))
    )
  ), queued_uploads as (
    insert into app_private.deletion_jobs(target_type, target_id, cloudinary_public_id)
    select 'upload', id::text, cloudinary_public_id from stale_uploads returning 1
  ), deleted_uploads as (
    delete from app_private.uploads where id in (select id from stale_uploads) returning 1
  )
  select (select count(*) from queued_uploads), (select count(*) from deleted_uploads)
  into queued_count, deleted_count;
  cleanup_details := cleanup_details || jsonb_build_object(
    'uploads_queued_for_deletion', queued_count,
    'uploads_deleted', deleted_count
  );

  with inactive_profiles as materialized (
    select profile.uid, profile.avatar_public_id
    from app_private.user_profiles profile
    where profile.avatar_public_id is not null
      and coalesce(profile.last_seen_at, profile.created_at) < now() - make_interval(days => inactive_avatar_days)
      and not exists (select 1 from app_private.issues issue where issue.author_uid = profile.uid)
      and not exists (select 1 from app_private.comments comment where comment.author_uid = profile.uid)
      and not exists (select 1 from app_private.facility_reports facility where facility.author_uid = profile.uid)
      and not exists (select 1 from app_private.announcements announcement where announcement.author_uid = profile.uid)
      and not exists (select 1 from app_private.announcement_comments comment where comment.author_uid = profile.uid)
    for update
  ), cleared_profiles as (
    update app_private.user_profiles profile
    set avatar_hash = null,
        avatar_public_id = null,
        avatar_source_url = null,
        avatar_checked_at = null,
        cached_photo_url = null,
        photo_url = null,
        avatar_version = profile.avatar_version + 1,
        profile_version = profile.profile_version + 1,
        updated_at = now()
    from inactive_profiles inactive
    where profile.uid = inactive.uid
    returning profile.uid, inactive.avatar_public_id
  ), queued_avatars as (
    insert into app_private.deletion_jobs(target_type, target_id, cloudinary_public_id)
    select 'avatar', uid, avatar_public_id from cleared_profiles returning 1
  )
  select (select count(*) from cleared_profiles), (select count(*) from queued_avatars)
  into deleted_count, queued_count;
  cleanup_details := cleanup_details || jsonb_build_object(
    'inactive_avatars_cleared', deleted_count,
    'inactive_avatar_deletions_queued', queued_count
  );

  update app_private.user_profiles profile
  set email = null,
      profile_version = profile.profile_version + 1,
      updated_at = now()
  where profile.email is not null
    and coalesce(profile.last_seen_at, profile.created_at) < now() - make_interval(days => inactive_profile_pii_days)
    and not exists (select 1 from app_private.user_role_assignments assignment where assignment.uid = profile.uid)
    and not exists (select 1 from app_private.user_issue_category_assignments assignment where assignment.uid = profile.uid)
    and not exists (select 1 from app_private.user_facility_category_assignments assignment where assignment.uid = profile.uid);
  get diagnostics deleted_count = row_count;
  cleanup_details := cleanup_details || jsonb_build_object('inactive_profile_emails_cleared', deleted_count);

  update app_private.user_profiles profile
  set display_name = null,
      profile_version = profile.profile_version + 1,
      updated_at = now()
  where profile.display_name is not null
    and coalesce(profile.last_seen_at, profile.created_at) < now() - make_interval(days => inactive_profile_pii_days)
    and not exists (select 1 from app_private.issues issue where issue.author_uid = profile.uid)
    and not exists (select 1 from app_private.comments comment where comment.author_uid = profile.uid)
    and not exists (select 1 from app_private.facility_reports facility where facility.author_uid = profile.uid)
    and not exists (select 1 from app_private.announcements announcement where announcement.author_uid = profile.uid)
    and not exists (select 1 from app_private.announcement_comments comment where comment.author_uid = profile.uid)
    and not exists (select 1 from app_private.user_role_assignments assignment where assignment.uid = profile.uid)
    and not exists (select 1 from app_private.user_issue_category_assignments assignment where assignment.uid = profile.uid)
    and not exists (select 1 from app_private.user_facility_category_assignments assignment where assignment.uid = profile.uid);
  get diagnostics deleted_count = row_count;
  cleanup_details := cleanup_details || jsonb_build_object('inactive_profile_names_cleared', deleted_count);

  delete from app_private.user_restrictions
  where not restricted_permanently
    and restricted_until < now() - make_interval(days => expired_restriction_days);
  get diagnostics deleted_count = row_count;
  cleanup_details := cleanup_details || jsonb_build_object('expired_user_restrictions_deleted', deleted_count);

  update app_private.notifications
  set expires_at = created_at + make_interval(days => notifications_days)
  where expires_at is distinct from created_at + make_interval(days => notifications_days);
  delete from app_private.notifications where expires_at < now();
  get diagnostics deleted_count = row_count;
  cleanup_details := cleanup_details || jsonb_build_object('notifications_deleted', deleted_count);

  update app_private.realtime_events
  set expires_at = created_at + make_interval(hours => realtime_hours)
  where expires_at is distinct from created_at + make_interval(hours => realtime_hours);
  delete from app_private.realtime_events where expires_at < now();
  get diagnostics deleted_count = row_count;
  cleanup_details := cleanup_details || jsonb_build_object('realtime_events_deleted', deleted_count);

  update app_private.outbox_events
  set status = 'failed', locked_at = null, updated_at = now()
  where status = 'processing' and attempt_count >= 8 and locked_at < now() - interval '15 minutes';
  get diagnostics deleted_count = row_count;
  cleanup_details := cleanup_details || jsonb_build_object('abandoned_outbox_events_failed', deleted_count);

  update app_private.push_delivery_logs
  set status = 'failed', locked_at = null, updated_at = now()
  where status = 'processing' and attempt_count >= 8 and locked_at < now() - interval '15 minutes';
  get diagnostics deleted_count = row_count;
  cleanup_details := cleanup_details || jsonb_build_object('abandoned_push_deliveries_failed', deleted_count);

  update app_private.deletion_jobs
  set status = 'failed', locked_at = null, updated_at = now()
  where status = 'processing' and attempt_count >= 8 and locked_at < now() - interval '15 minutes';
  get diagnostics deleted_count = row_count;
  cleanup_details := cleanup_details || jsonb_build_object('abandoned_deletion_jobs_failed', deleted_count);

  update app_private.outbox_events
  set expires_at = updated_at + case status
    when 'completed' then make_interval(days => outbox_completed_days)
    else make_interval(days => outbox_failed_days)
  end
  where status in ('completed', 'failed');
  delete from app_private.outbox_events where status in ('completed', 'failed') and expires_at < now();
  get diagnostics deleted_count = row_count;
  cleanup_details := cleanup_details || jsonb_build_object('outbox_events_deleted', deleted_count);

  delete from app_private.push_delivery_logs
  where (status = 'sent' and updated_at < now() - make_interval(days => push_sent_days))
    or (status = 'failed' and updated_at < now() - make_interval(days => push_failed_days));
  get diagnostics deleted_count = row_count;
  cleanup_details := cleanup_details || jsonb_build_object('push_delivery_logs_deleted', deleted_count);

  update app_private.idempotency_keys
  set expires_at = updated_at + make_interval(hours => idempotency_hours)
  where expires_at is distinct from updated_at + make_interval(hours => idempotency_hours);
  delete from app_private.idempotency_keys where expires_at < now();
  get diagnostics deleted_count = row_count;
  cleanup_details := cleanup_details || jsonb_build_object('idempotency_keys_deleted', deleted_count);

  delete from app_private.push_tokens
  where permission <> 'granted'
    or last_confirmed_at < now() - make_interval(days => inactive_push_token_days);
  get diagnostics deleted_count = row_count;
  cleanup_details := cleanup_details || jsonb_build_object('push_tokens_deleted', deleted_count);

  delete from app_private.deletion_jobs
  where (status = 'completed' and updated_at < now() - make_interval(days => deletion_completed_days))
    or (status = 'failed' and updated_at < now() - make_interval(days => deletion_failed_days));
  get diagnostics deleted_count = row_count;
  cleanup_details := cleanup_details || jsonb_build_object('deletion_jobs_deleted', deleted_count);

  delete from app_private.role_assignment_audit
  where created_at < now() - make_interval(days => role_audit_days);
  get diagnostics deleted_count = row_count;
  cleanup_details := cleanup_details || jsonb_build_object('role_assignment_audit_deleted', deleted_count);

  delete from app_private.category_configuration_audit
  where created_at < now() - make_interval(days => category_audit_days);
  get diagnostics deleted_count = row_count;
  cleanup_details := cleanup_details || jsonb_build_object('category_configuration_audit_deleted', deleted_count);

  delete from app_private.access_assignment_audit
  where created_at < now() - make_interval(days => access_audit_days);
  get diagnostics deleted_count = row_count;
  cleanup_details := cleanup_details || jsonb_build_object('access_assignment_audit_deleted', deleted_count);

  delete from app_private.admin_audit_log
  where created_at < now() - make_interval(days => role_audit_days);
  get diagnostics deleted_count = row_count;
  cleanup_details := cleanup_details || jsonb_build_object('admin_audit_log_deleted', deleted_count);

  select count(*)::integer into failed_deletion_jobs
  from app_private.deletion_jobs where status = 'failed';
  cleanup_details := cleanup_details || jsonb_build_object('failed_deletion_jobs', failed_deletion_jobs);
  if failed_deletion_jobs > 0 then run_status := 'attention'; end if;

  delete from app_private.maintenance_runs
  where task_name = 'maintenance.cleanup'
    and id <> run_id
    and started_at < now() - make_interval(days => maintenance_days);

  update app_private.maintenance_runs
  set status = run_status, completed_at = now(), details = cleanup_details
  where id = run_id;

  return jsonb_build_object('ok', true, 'run_id', run_id, 'status', run_status, 'details', cleanup_details);
exception
  when others then
    if run_id is not null then
      update app_private.maintenance_runs
      set status = 'failed', completed_at = now(), error_trace_id = gen_random_uuid(), details = cleanup_details
      where id = run_id returning error_trace_id into failure_trace_id;
      raise warning 'maintenance failure trace %, error %', failure_trace_id, sqlerrm;
    end if;
    raise;
end;
$$;
