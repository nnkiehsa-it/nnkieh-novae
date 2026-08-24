update app_private.runtime_settings
set value = (jsonb_build_object('adminAuditDays', 365) || value::jsonb)::text,
    updated_at = now()
where key = 'data_retention_settings';

create function app_private.retention_integer(
  retention_config jsonb,
  setting_key text
)
returns integer
language plpgsql
immutable
set search_path to 'pg_catalog'
as $$
declare
  setting_value numeric;
  maximum integer := case when setting_key like '%Hours' then 87600 else 3650 end;
begin
  if jsonb_typeof(retention_config -> setting_key) <> 'number' then
    raise exception 'validation-required';
  end if;
  setting_value := (retention_config ->> setting_key)::numeric;
  if setting_value <> trunc(setting_value) or setting_value < 1 or setting_value > maximum then
    raise exception 'validation-required';
  end if;
  return setting_value::integer;
end;
$$;

create function app_private.retention_boolean(
  retention_config jsonb,
  setting_key text
)
returns boolean
language plpgsql
immutable
set search_path to 'pg_catalog'
as $$
begin
  if jsonb_typeof(retention_config -> setting_key) <> 'boolean' then
    raise exception 'validation-required';
  end if;
  return (retention_config ->> setting_key)::boolean;
end;
$$;

create function app_private.assert_retention_config(retention_config jsonb)
returns void
language plpgsql
immutable
set search_path to 'app_private', 'pg_catalog'
as $$
declare
  setting_key text;
begin
  if jsonb_typeof(retention_config) <> 'object' then
    raise exception 'validation-required';
  end if;
  foreach setting_key in array array[
    'closedIssuesEnabled', 'closedFacilitiesEnabled', 'announcementsEnabled',
    'notificationsEnabled', 'inactiveAvatarsEnabled', 'inactiveProfilePiiEnabled',
    'expiredRestrictionsEnabled'
  ] loop
    perform app_private.retention_boolean(retention_config, setting_key);
  end loop;
  foreach setting_key in array array[
    'closedIssuesDays', 'closedFacilitiesDays', 'announcementsDays', 'notificationsDays',
    'realtimeEventsHours', 'outboxCompletedDays', 'outboxFailedDays',
    'pushDeliverySentDays', 'pushDeliveryFailedDays', 'idempotencyHours',
    'inactivePushTokensDays', 'pushTokenConfirmationDays', 'inactiveAvatarsDays',
    'inactiveProfilePiiDays', 'expiredRestrictionsDays', 'deletionJobCompletedDays',
    'deletionJobFailedDays', 'maintenanceRunsDays', 'platformJobsDays',
    'roleAssignmentAuditDays', 'adminAuditDays', 'categoryConfigurationAuditDays',
    'accessAssignmentAuditDays', 'pendingUploadHours', 'unattachedUploadHours',
    'failedUploadHours'
  ] loop
    perform app_private.retention_integer(retention_config, setting_key);
  end loop;
end;
$$;

create function app_private.runtime_retention_config()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'app_private', 'pg_catalog'
as $$
declare
  retention_config jsonb;
begin
  select value::jsonb into strict retention_config
  from app_private.runtime_settings
  where key = 'data_retention_settings';
  perform app_private.assert_retention_config(retention_config);
  return retention_config;
exception
  when no_data_found then raise exception 'runtime-retention-settings-missing';
end;
$$;

create function app_private.runtime_retention_deadline(
  setting_key text,
  enabled_key text default null
)
returns timestamptz
language plpgsql
stable
security definer
set search_path to 'app_private', 'pg_catalog'
as $$
declare
  retention_config jsonb := app_private.runtime_retention_config();
  amount integer;
begin
  if enabled_key is not null and not app_private.retention_boolean(retention_config, enabled_key) then
    return 'infinity'::timestamptz;
  end if;
  amount := app_private.retention_integer(retention_config, setting_key);
  return now() + case when setting_key like '%Hours'
    then make_interval(hours => amount)
    else make_interval(days => amount)
  end;
end;
$$;

alter table app_private.notifications
  alter column expires_at set default app_private.runtime_retention_deadline('notificationsDays', 'notificationsEnabled');
alter table app_private.realtime_events
  alter column expires_at set default app_private.runtime_retention_deadline('realtimeEventsHours');
alter table app_private.outbox_events
  alter column expires_at set default app_private.runtime_retention_deadline('outboxCompletedDays');
alter table app_private.idempotency_keys
  alter column expires_at set default app_private.runtime_retention_deadline('idempotencyHours');
alter table app_private.uploads
  alter column expires_at set default app_private.runtime_retention_deadline('pendingUploadHours');

create or replace function app_api.claim_idempotency_key(actor_uid text, action_name text, request_id text)
returns table(claimed boolean, completed boolean, response jsonb)
language plpgsql
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
declare
  existing app_private.idempotency_keys%rowtype;
  inserted_count integer := 0;
begin
  if length(btrim(coalesce(actor_uid,''))) = 0 or length(btrim(coalesce(action_name,''))) = 0
    or length(btrim(coalesce(request_id,''))) = 0 or length(request_id) > 120
  then raise exception 'validation-invalid'; end if;
  insert into app_private.idempotency_keys(uid,action,request_id)
  values(actor_uid,action_name,request_id) on conflict do nothing;
  get diagnostics inserted_count = row_count;
  select * into existing from app_private.idempotency_keys
  where uid=actor_uid and action=action_name and idempotency_keys.request_id=claim_idempotency_key.request_id
  for update;
  if inserted_count = 1 then return query select true,false,null::jsonb; return; end if;
  if existing.status = 'completed' then return query select false,true,existing.response; return; end if;
  if existing.updated_at < now() - interval '10 minutes' then
    update app_private.idempotency_keys
    set updated_at=now(), expires_at=app_private.runtime_retention_deadline('idempotencyHours')
    where uid=actor_uid and action=action_name and idempotency_keys.request_id=claim_idempotency_key.request_id;
    return query select true,false,null::jsonb; return;
  end if;
  return query select false,false,null::jsonb;
end;
$$;

create or replace function app_api.complete_idempotency_key(actor_uid text, action_name text, request_id text, action_response jsonb)
returns void
language sql
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
  update app_private.idempotency_keys
  set status='completed', response=action_response, updated_at=now(),
      expires_at=app_private.runtime_retention_deadline('idempotencyHours')
  where uid=actor_uid and action=action_name
    and idempotency_keys.request_id=complete_idempotency_key.request_id and status='processing';
$$;

create or replace function app_api.complete_outbox_event(event_id uuid)
returns void
language sql
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
  update app_private.outbox_events
  set status='completed', updated_at=now(), expires_at=app_private.runtime_retention_deadline('outboxCompletedDays')
  where id=event_id;
$$;

create or replace function app_api.fail_outbox_event(event_id uuid, error_trace_id uuid)
returns void
language sql
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
  update app_private.outbox_events
  set status='failed', error_trace_id=fail_outbox_event.error_trace_id,
      next_attempt_at=now()+make_interval(mins=>least(60,greatest(1,attempt_count*2))),
      updated_at=now(), expires_at=app_private.runtime_retention_deadline('outboxFailedDays')
  where id=event_id;
$$;

create or replace function app_private.retention_cleanup_estimate(retention_config jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'app_private', 'public'
as $$
declare
  details jsonb;
  total bigint;
  closed_issue_days integer;
  closed_facility_days integer;
  announcement_days integer;
  notifications_days integer;
  realtime_hours integer;
  outbox_completed_days integer;
  outbox_failed_days integer;
  push_sent_days integer;
  push_failed_days integer;
  idempotency_hours integer;
  inactive_push_days integer;
  inactive_avatar_days integer;
  inactive_pii_days integer;
  restriction_days integer;
  deletion_completed_days integer;
  deletion_failed_days integer;
  maintenance_days integer;
  platform_job_days integer;
  role_audit_days integer;
  admin_audit_days integer;
  category_audit_days integer;
  access_audit_days integer;
  pending_upload_hours integer;
  unattached_upload_hours integer;
  failed_upload_hours integer;
begin
  perform app_private.assert_retention_config(retention_config);
  closed_issue_days:=app_private.retention_integer(retention_config,'closedIssuesDays');
  closed_facility_days:=app_private.retention_integer(retention_config,'closedFacilitiesDays');
  announcement_days:=app_private.retention_integer(retention_config,'announcementsDays');
  notifications_days:=app_private.retention_integer(retention_config,'notificationsDays');
  realtime_hours:=app_private.retention_integer(retention_config,'realtimeEventsHours');
  outbox_completed_days:=app_private.retention_integer(retention_config,'outboxCompletedDays');
  outbox_failed_days:=app_private.retention_integer(retention_config,'outboxFailedDays');
  push_sent_days:=app_private.retention_integer(retention_config,'pushDeliverySentDays');
  push_failed_days:=app_private.retention_integer(retention_config,'pushDeliveryFailedDays');
  idempotency_hours:=app_private.retention_integer(retention_config,'idempotencyHours');
  inactive_push_days:=app_private.retention_integer(retention_config,'inactivePushTokensDays');
  inactive_avatar_days:=app_private.retention_integer(retention_config,'inactiveAvatarsDays');
  inactive_pii_days:=app_private.retention_integer(retention_config,'inactiveProfilePiiDays');
  restriction_days:=app_private.retention_integer(retention_config,'expiredRestrictionsDays');
  deletion_completed_days:=app_private.retention_integer(retention_config,'deletionJobCompletedDays');
  deletion_failed_days:=app_private.retention_integer(retention_config,'deletionJobFailedDays');
  maintenance_days:=app_private.retention_integer(retention_config,'maintenanceRunsDays');
  platform_job_days:=app_private.retention_integer(retention_config,'platformJobsDays');
  role_audit_days:=app_private.retention_integer(retention_config,'roleAssignmentAuditDays');
  admin_audit_days:=app_private.retention_integer(retention_config,'adminAuditDays');
  category_audit_days:=app_private.retention_integer(retention_config,'categoryConfigurationAuditDays');
  access_audit_days:=app_private.retention_integer(retention_config,'accessAssignmentAuditDays');
  pending_upload_hours:=app_private.retention_integer(retention_config,'pendingUploadHours');
  unattached_upload_hours:=app_private.retention_integer(retention_config,'unattachedUploadHours');
  failed_upload_hours:=app_private.retention_integer(retention_config,'failedUploadHours');

  select jsonb_build_object(
    'closedIssues',(select count(*) from app_private.issues where app_private.retention_boolean(retention_config,'closedIssuesEnabled') and status in('auto-rejected','review-rejected','infeasible','completed') and closed_at<now()-make_interval(days=>closed_issue_days)),
    'closedFacilities',(select count(*) from app_private.facility_reports where app_private.retention_boolean(retention_config,'closedFacilitiesEnabled') and status in('completed','unable-to-handle') and closed_at<now()-make_interval(days=>closed_facility_days)),
    'announcements',(select count(*) from app_private.announcements where app_private.retention_boolean(retention_config,'announcementsEnabled') and published_at<now()-make_interval(days=>announcement_days)),
    'uploads',(select count(*) from app_private.uploads where cloudinary_public_id is not null and ((status='pending' and created_at<now()-make_interval(hours=>pending_upload_hours)) or (status='ready' and attached_target_id is null and updated_at<now()-make_interval(hours=>unattached_upload_hours)) or (status='failed' and updated_at<now()-make_interval(hours=>failed_upload_hours)))),
    'inactiveAvatars',(select count(*) from app_private.user_profiles profile where app_private.retention_boolean(retention_config,'inactiveAvatarsEnabled') and avatar_public_id is not null and coalesce(last_seen_at,created_at)<now()-make_interval(days=>inactive_avatar_days) and not exists(select 1 from app_private.issues where author_uid=profile.uid) and not exists(select 1 from app_private.comments where author_uid=profile.uid) and not exists(select 1 from app_private.facility_reports where author_uid=profile.uid) and not exists(select 1 from app_private.announcements where author_uid=profile.uid) and not exists(select 1 from app_private.announcement_comments where author_uid=profile.uid)),
    'inactiveProfilePii',(select count(*) from app_private.user_profiles profile where app_private.retention_boolean(retention_config,'inactiveProfilePiiEnabled') and coalesce(last_seen_at,created_at)<now()-make_interval(days=>inactive_pii_days) and not exists(select 1 from app_private.user_role_assignments where uid=profile.uid) and not exists(select 1 from app_private.user_issue_category_assignments where uid=profile.uid) and not exists(select 1 from app_private.user_facility_category_assignments where uid=profile.uid) and (email is not null or (display_name is not null and not exists(select 1 from app_private.issues where author_uid=profile.uid) and not exists(select 1 from app_private.comments where author_uid=profile.uid) and not exists(select 1 from app_private.facility_reports where author_uid=profile.uid) and not exists(select 1 from app_private.announcements where author_uid=profile.uid) and not exists(select 1 from app_private.announcement_comments where author_uid=profile.uid)))),
    'restrictions',(select count(*) from app_private.user_restrictions where app_private.retention_boolean(retention_config,'expiredRestrictionsEnabled') and not restricted_permanently and restricted_until<now()-make_interval(days=>restriction_days)),
    'notifications',(select count(*) from app_private.notifications where expires_at is distinct from case when app_private.retention_boolean(retention_config,'notificationsEnabled') then created_at+make_interval(days=>notifications_days) else 'infinity'::timestamptz end or (app_private.retention_boolean(retention_config,'notificationsEnabled') and created_at+make_interval(days=>notifications_days)<now())),
    'realtime',(select count(*) from app_private.realtime_events where expires_at is distinct from created_at+make_interval(hours=>realtime_hours) or created_at+make_interval(hours=>realtime_hours)<now()),
    'outbox',(select count(*) from app_private.outbox_events where (status='processing' and attempt_count>=8 and locked_at<now()-interval '15 minutes') or (status in('completed','failed') and (expires_at is distinct from updated_at+case status when 'completed' then make_interval(days=>outbox_completed_days) else make_interval(days=>outbox_failed_days) end or updated_at+case status when 'completed' then make_interval(days=>outbox_completed_days) else make_interval(days=>outbox_failed_days) end<now()))),
    'pushDeliveries',(select count(*) from app_private.push_delivery_logs where (status='processing' and attempt_count>=8 and locked_at<now()-interval '15 minutes') or (status='sent' and updated_at<now()-make_interval(days=>push_sent_days)) or (status='failed' and updated_at<now()-make_interval(days=>push_failed_days))),
    'idempotency',(select count(*) from app_private.idempotency_keys where expires_at is distinct from updated_at+make_interval(hours=>idempotency_hours) or updated_at+make_interval(hours=>idempotency_hours)<now()),
    'pushTokens',(select count(*) from app_private.push_tokens where permission<>'granted' or last_confirmed_at<now()-make_interval(days=>inactive_push_days)),
    'deletionJobs',(select count(*) from app_private.deletion_jobs where (status='processing' and attempt_count>=8 and locked_at<now()-interval '15 minutes') or (status='completed' and updated_at<now()-make_interval(days=>deletion_completed_days)) or (status='failed' and updated_at<now()-make_interval(days=>deletion_failed_days))),
    'auditLogs',(select (select count(*) from app_private.role_assignment_audit where created_at<now()-make_interval(days=>role_audit_days))+(select count(*) from app_private.admin_audit_log where created_at<now()-make_interval(days=>admin_audit_days))+(select count(*) from app_private.category_configuration_audit where created_at<now()-make_interval(days=>category_audit_days))+(select count(*) from app_private.access_assignment_audit where created_at<now()-make_interval(days=>access_audit_days))),
    'maintenanceRuns',(select count(*) from app_private.maintenance_runs where started_at<now()-make_interval(days=>maintenance_days)),
    'platformJobs',(select count(*) from app_private.platform_jobs where status in('completed','failed','superseded') and updated_at<now()-make_interval(days=>platform_job_days)),
    'notionMappings',(select count(*) from app_private.notion_pages page where (target_type='announcement' and not exists(select 1 from app_private.announcements where id::text=page.target_id)) or (target_type='admin-audit' and not exists(select 1 from app_private.admin_audit_log where id::text=page.target_id)) or (target_type='issue' and not exists(select 1 from app_private.issues where id::text=page.target_id)) or (target_type='facility' and not exists(select 1 from app_private.facility_reports where id::text=page.target_id)))
  ) into details;
  select coalesce(sum(value::text::bigint),0) into total from jsonb_each(details);
  return jsonb_build_object('details',details,'totalEstimatedRows',total);
end;
$$;

alter function app_private.run_retention_cleanup_batch(jsonb, integer)
  rename to run_retention_cleanup_core_batch;

create function app_private.run_retention_cleanup_batch(
  retention_config jsonb,
  batch_size integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path to 'app_private', 'public'
as $$
declare
  limited integer := least(greatest(coalesce(batch_size,100),1),500);
  core_config jsonb;
  core_result jsonb;
  details jsonb;
  changed integer := 0;
  audit_changed integer := 0;
  total_changed integer;
  has_more boolean;
  role_audit_days integer;
  admin_audit_days integer;
  inactive_pii_days integer;
begin
  perform app_private.assert_retention_config(retention_config);
  role_audit_days:=app_private.retention_integer(retention_config,'roleAssignmentAuditDays');
  admin_audit_days:=app_private.retention_integer(retention_config,'adminAuditDays');
  inactive_pii_days:=app_private.retention_integer(retention_config,'inactiveProfilePiiDays');

  core_config:=jsonb_set(
    jsonb_set(retention_config,'{inactiveProfilePiiEnabled}','false'::jsonb),
    '{roleAssignmentAuditDays}',
    to_jsonb(greatest(role_audit_days,admin_audit_days))
  );
  core_result:=app_private.run_retention_cleanup_core_batch(core_config,limited);
  details:=coalesce(core_result->'details','{}'::jsonb);
  total_changed:=coalesce((core_result->>'affectedRows')::integer,0);
  has_more:=coalesce((core_result->>'hasMore')::boolean,false);

  if app_private.retention_boolean(retention_config,'inactiveProfilePiiEnabled') then
    with targets as (
      select uid
      from app_private.user_profiles profile
      where coalesce(last_seen_at,created_at)<now()-make_interval(days=>inactive_pii_days)
        and not exists(select 1 from app_private.user_role_assignments where uid=profile.uid)
        and not exists(select 1 from app_private.user_issue_category_assignments where uid=profile.uid)
        and not exists(select 1 from app_private.user_facility_category_assignments where uid=profile.uid)
        and (
          email is not null
          or (
            display_name is not null
            and not exists(select 1 from app_private.issues where author_uid=profile.uid)
            and not exists(select 1 from app_private.comments where author_uid=profile.uid)
            and not exists(select 1 from app_private.facility_reports where author_uid=profile.uid)
            and not exists(select 1 from app_private.announcements where author_uid=profile.uid)
            and not exists(select 1 from app_private.announcement_comments where author_uid=profile.uid)
          )
        )
      order by uid
      limit limited
    ), cleared as (
      update app_private.user_profiles profile
      set email=null,
          display_name=case
            when not exists(select 1 from app_private.issues where author_uid=profile.uid)
              and not exists(select 1 from app_private.comments where author_uid=profile.uid)
              and not exists(select 1 from app_private.facility_reports where author_uid=profile.uid)
              and not exists(select 1 from app_private.announcements where author_uid=profile.uid)
              and not exists(select 1 from app_private.announcement_comments where author_uid=profile.uid)
            then null else profile.display_name end,
          profile_version=profile.profile_version+1,
          updated_at=now()
      where uid in(select uid from targets)
      returning 1
    ) select count(*) into changed from cleared;
    total_changed:=total_changed+changed;
    has_more:=has_more or changed=limited;
    details:=details||jsonb_build_object('inactiveProfilePii',changed);
  end if;

  if not app_private.retention_boolean(retention_config,'notificationsEnabled') then
    with targets as (
      select id from app_private.notifications
      where expires_at is distinct from 'infinity'::timestamptz
      order by id limit limited
    ), retained as (
      update app_private.notifications
      set expires_at='infinity'::timestamptz
      where id in(select id from targets)
      returning 1
    ) select count(*) into changed from retained;
    total_changed:=total_changed+changed;
    has_more:=has_more or changed=limited;
    details:=details||jsonb_build_object('notifications',changed);
  end if;

  with targets as (
    select id from app_private.role_assignment_audit
    where created_at<now()-make_interval(days=>role_audit_days)
    order by id limit limited
  ), deleted as (
    delete from app_private.role_assignment_audit where id in(select id from targets) returning 1
  ) select count(*) into changed from deleted;
  total_changed:=total_changed+changed;
  audit_changed:=audit_changed+changed;
  has_more:=has_more or changed=limited;

  with targets as (
    select id from app_private.admin_audit_log
    where created_at<now()-make_interval(days=>admin_audit_days)
    order by id limit limited
  ), deleted as (
    delete from app_private.admin_audit_log where id in(select id from targets) returning 1
  ) select count(*) into changed from deleted;
  total_changed:=total_changed+changed;
  audit_changed:=audit_changed+changed;
  has_more:=has_more or changed=limited;
  details:=jsonb_set(details,'{auditLogs}',to_jsonb(
    coalesce((details->>'auditLogs')::integer,0)+audit_changed
  ));

  with targets as (
    select target_type,target_id
    from app_private.notion_pages page
    where (target_type='announcement' and not exists(select 1 from app_private.announcements where id::text=page.target_id))
       or (target_type='admin-audit' and not exists(select 1 from app_private.admin_audit_log where id::text=page.target_id))
       or (target_type='issue' and not exists(select 1 from app_private.issues where id::text=page.target_id))
       or (target_type='facility' and not exists(select 1 from app_private.facility_reports where id::text=page.target_id))
    order by target_type,target_id
    limit limited
  ), deleted as (
    delete from app_private.notion_pages page
    using targets
    where page.target_type=targets.target_type and page.target_id=targets.target_id
    returning 1
  ) select count(*) into changed from deleted;
  total_changed:=total_changed+changed;
  has_more:=has_more or changed=limited;
  details:=details||jsonb_build_object('notionMappings',changed);

  return jsonb_build_object('affectedRows',total_changed,'hasMore',has_more,'details',details);
end;
$$;

create or replace function app_api.backend_estimate_retention_cleanup(actor_uid text, retention_config jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'app_private','app_api','public'
as $$
begin
  if not app_private.actor_has_permission(actor_uid,'category.manage') then raise exception 'permission-denied'; end if;
  perform app_private.assert_retention_config(retention_config);
  return app_private.retention_cleanup_estimate(retention_config);
end;
$$;

create or replace function app_api.backend_save_platform_settings(actor_uid text, image_settings jsonb, retention_config jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'app_private','app_api','public'
as $$
declare job_id uuid; estimate bigint;
begin
  if not app_private.actor_has_permission(actor_uid,'category.manage') then raise exception 'permission-denied'; end if;
  perform app_private.assert_retention_config(retention_config);
  insert into app_private.runtime_settings(key,value,updated_at) values
    ('image_upload_settings',image_settings::text,now()),
    ('data_retention_settings',retention_config::text,now())
  on conflict(key) do update set value=excluded.value,updated_at=excluded.updated_at;
  job_id:=app_private.enqueue_policy_job('retention-cleanup','global',retention_config,actor_uid);
  select estimated_rows into estimate from app_private.platform_jobs where id=job_id;
  insert into app_private.category_configuration_audit(domain,operation,actor_uid,before_value,after_value)
  values('platform','update-retention',actor_uid,null,retention_config);
  return jsonb_build_object('jobId',job_id,'estimatedRows',estimate);
end;
$$;

drop function app_api.run_scheduled_maintenance_cleanup(jsonb);
create function app_api.run_scheduled_maintenance_cleanup()
returns jsonb
language plpgsql
security definer
set search_path to 'app_private','app_api','public'
as $$
declare
  job_id uuid;
  retention_config jsonb:=app_private.runtime_retention_config();
begin
  select id into job_id from app_private.platform_jobs
  where job_type='retention-cleanup' and scope_id='global' and status in('pending','processing')
  order by created_at desc limit 1;
  if job_id is null then
    job_id:=app_private.enqueue_policy_job('retention-cleanup','global',retention_config,'system');
  end if;
  return jsonb_build_object(
    'result',jsonb_build_object('jobId',job_id),
    'dueWorkers',jsonb_build_object(
      'outbox',exists(select 1 from app_private.outbox_events event where event.attempt_count<8 and ((event.status in('pending','failed') and event.next_attempt_at<=now()) or (event.status='processing' and event.locked_at<now()-interval '10 minutes'))),
      'deletion',exists(select 1 from app_private.deletion_jobs job where job.attempt_count<8 and ((job.status in('pending','failed') and job.next_attempt_at<=now()) or (job.status='processing' and job.locked_at<now()-interval '10 minutes')))
    )
  );
end;
$$;

drop function app_api.run_maintenance_cleanup(text[],jsonb);
drop function app_private.run_maintenance_cleanup(text[],jsonb);

revoke all on function app_private.retention_integer(jsonb,text) from public;
revoke all on function app_private.retention_boolean(jsonb,text) from public;
revoke all on function app_private.assert_retention_config(jsonb) from public;
revoke all on function app_private.runtime_retention_config() from public;
revoke all on function app_private.runtime_retention_deadline(text,text) from public;
revoke all on function app_private.run_retention_cleanup_core_batch(jsonb,integer) from public;
revoke all on function app_private.run_retention_cleanup_batch(jsonb,integer) from public;
