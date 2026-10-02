-- Separate saved policy changes from scheduled maintenance; reports distinguish deletion from expiry updates.

alter table app_private.category_configuration_audit
  drop constraint category_configuration_audit_operation_check,
  add constraint category_configuration_audit_operation_check check (
    operation in ('create','update','archive','restore','delete','complete-setup','update-features','update-retention','update-platform-settings')
  );

create or replace function app_private.retention_scope_enabled(config jsonb, scope text)
returns boolean language sql immutable
set search_path to 'app_private', 'public'
as $$ select not (config ? 'cleanupScopes') or config->'cleanupScopes' ? scope $$;

-- Only tighter rules delete existing data. Notification expiry must also be updated
-- when retention is relaxed or disabled. Row-lifecycle TTLs apply to future rows.
create or replace function app_private.retention_change_scopes(before_config jsonb, after_config jsonb)
returns jsonb language plpgsql immutable
set search_path to 'app_private', 'public'
as $$
declare rule record; scopes jsonb := '[]'::jsonb; enabled boolean;
begin
  for rule in select * from (values
    ('closedIssues', 'closedIssuesEnabled', 'closedIssuesDays'),
    ('closedFacilities', 'closedFacilitiesEnabled', 'closedFacilitiesDays'),
    ('announcements', 'announcementsEnabled', 'announcementsDays'),
    ('inactiveAvatars', 'inactiveAvatarsEnabled', 'inactiveAvatarsDays'),
    ('inactiveProfilePii', 'inactiveProfilePiiEnabled', 'inactiveProfilePiiDays'),
    ('restrictions', 'expiredRestrictionsEnabled', 'expiredRestrictionsDays'),
    ('pushTokens', null, 'inactivePushTokensDays'),
    ('domainEvents', null, 'domainEventDays'),
    ('roleAssignmentAudit', null, 'roleAssignmentAuditDays'),
    ('adminAudit', null, 'adminAuditDays'),
    ('categoryConfigurationAudit', null, 'categoryConfigurationAuditDays'),
    ('accessAssignmentAudit', null, 'accessAssignmentAuditDays'),
    ('pendingUploads', null, 'pendingUploadHours'),
    ('unattachedUploads', null, 'unattachedUploadHours'),
    ('failedUploads', null, 'failedUploadHours')
  ) as rules(scope, switch_key, duration_key) loop
    enabled := rule.switch_key is null or (after_config->>rule.switch_key)::boolean;
    if enabled and (
      (rule.switch_key is not null and not (before_config->>rule.switch_key)::boolean)
      or (after_config->>rule.duration_key)::integer < (before_config->>rule.duration_key)::integer
    ) then scopes := scopes || jsonb_build_array(rule.scope); end if;
  end loop;
  if before_config->'notificationsEnabled' is distinct from after_config->'notificationsEnabled'
    or ((after_config->>'notificationsEnabled')::boolean and before_config->'notificationsDays' is distinct from after_config->'notificationsDays')
  then scopes := scopes || '["notificationExpiry"]'::jsonb; end if;
  if (after_config->>'notificationsEnabled')::boolean and (
    not (before_config->>'notificationsEnabled')::boolean
    or (after_config->>'notificationsDays')::integer < (before_config->>'notificationsDays')::integer
  ) then scopes := scopes || '["notifications"]'::jsonb; end if;
  return scopes;
end;
$$;


create or replace function app_private.run_retention_cleanup_core_batch(
  retention_config jsonb,
  limited integer
)
returns jsonb
language plpgsql
security definer
set search_path to 'app_private', 'public'
as $$
declare
  changed integer := 0;
  total_changed integer := 0;
  has_more boolean := false;
  details jsonb := '{}'::jsonb;
  cleanup_operation_id uuid := gen_random_uuid();
  closed_issue_days integer := app_private.retention_integer(retention_config, 'closedIssuesDays');
  closed_facility_days integer := app_private.retention_integer(retention_config, 'closedFacilitiesDays');
  announcement_days integer := app_private.retention_integer(retention_config, 'announcementsDays');
  notifications_days integer := app_private.retention_integer(retention_config, 'notificationsDays');
  inactive_push_days integer := app_private.retention_integer(retention_config, 'inactivePushTokensDays');
  inactive_avatar_days integer := app_private.retention_integer(retention_config, 'inactiveAvatarsDays');
  restriction_days integer := app_private.retention_integer(retention_config, 'expiredRestrictionsDays');
  category_audit_days integer := app_private.retention_integer(retention_config, 'categoryConfigurationAuditDays');
  access_audit_days integer := app_private.retention_integer(retention_config, 'accessAssignmentAuditDays');
  pending_upload_hours integer := app_private.retention_integer(retention_config, 'pendingUploadHours');
  unattached_upload_hours integer := app_private.retention_integer(retention_config, 'unattachedUploadHours');
  failed_upload_hours integer := app_private.retention_integer(retention_config, 'failedUploadHours');
begin
  insert into app_private.operations(operation_id, actor_uid, action, status, response)
  values (
    cleanup_operation_id,
    'system',
    'retentionCleanup',
    'completed',
    jsonb_build_object('source', 'background_job')
  );

  if app_private.retention_scope_enabled(retention_config, 'operations') then
  -- 1. Operations cleanup
  with targets as (
    select operation_id from app_private.operations
    where expires_at < now()
      and not exists (
        select 1 from app_private.domain_events event
        where event.operation_id = operations.operation_id
      )
      and not exists (
        select 1 from app_private.admin_audit_log audit
        where audit.operation_id = operations.operation_id
      )
    order by operation_id limit limited
  ), deleted as (
    delete from app_private.operations where operation_id in (select operation_id from targets) returning 1
  ) select count(*) into changed from deleted;
  total_changed := total_changed + changed;
  has_more := has_more or changed = limited;
  details := details || jsonb_build_object('operations', changed);
  end if;

  if app_private.retention_scope_enabled(retention_config, 'eventDeliveries') then
  -- 2. Event deliveries cleanup
  with targets as (
    select id from app_private.event_deliveries
    where (status in ('completed', 'failed') and expires_at < now())
       or (status = 'processing' and attempt_count >= 8 and locked_at < now() - interval '15 minutes')
    order by id limit limited
  ), deleted as (
    delete from app_private.event_deliveries where id in (select id from targets) returning 1
  ) select count(*) into changed from deleted;
  total_changed := total_changed + changed;
  has_more := has_more or changed = limited;
  details := details || jsonb_build_object('eventDeliveries', changed);
  end if;

  if app_private.retention_scope_enabled(retention_config, 'backgroundJobs') then
  -- 3. Background jobs cleanup
  with targets as (
    select id from app_private.background_jobs
    where (status in ('completed', 'failed', 'superseded') and expires_at < now())
       or (status = 'processing' and attempt_count >= 8 and locked_at < now() - interval '15 minutes')
    order by id limit limited
  ), deleted as (
    delete from app_private.background_jobs where id in (select id from targets) returning 1
  ) select count(*) into changed from deleted;
  total_changed := total_changed + changed;
  has_more := has_more or changed = limited;
  details := details || jsonb_build_object('backgroundJobs', changed);
  end if;

  if app_private.retention_scope_enabled(retention_config, 'restrictions') then
  -- 4. Expired restrictions
  if app_private.retention_boolean(retention_config, 'expiredRestrictionsEnabled') then
    with targets as (
      select uid from app_private.user_restrictions
      where not restricted_permanently and restricted_until < now() - make_interval(days => restriction_days)
      order by uid limit limited
    ), deleted as (
      delete from app_private.user_restrictions where uid in (select uid from targets) returning 1
    ) select count(*) into changed from deleted;
    total_changed := total_changed + changed;
    has_more := has_more or changed = limited;
    details := details || jsonb_build_object('restrictions', changed);
  end if;
  end if;

  if app_private.retention_scope_enabled(retention_config, 'pushTokens') then
  -- 5. Inactive push tokens
  with targets as (
    select uid, device_id from app_private.push_tokens
    where permission <> 'granted' or last_confirmed_at < now() - make_interval(days => inactive_push_days)
    order by uid, device_id limit limited
  ), deleted as (
    delete from app_private.push_tokens pt
    using targets
    where pt.uid = targets.uid and pt.device_id = targets.device_id
    returning 1
  ) select count(*) into changed from deleted;
  total_changed := total_changed + changed;
  has_more := has_more or changed = limited;
  details := details || jsonb_build_object('pushTokens', changed);
  end if;

  if app_private.retention_scope_enabled(retention_config, 'notifications')
    and app_private.retention_boolean(retention_config, 'notificationsEnabled') then
  -- 6. Notification expiry updates are counted separately from deletion.
    with targets as (
      select id from app_private.notifications
      where created_at + make_interval(days => notifications_days) < now()
      order by id limit limited
    ), deleted as (
      delete from app_private.notifications where id in (select id from targets) returning 1
    ) select count(*) into changed from deleted;
    total_changed := total_changed + changed;
    has_more := has_more or changed = limited;
    details := details || jsonb_build_object('notifications', changed);
  end if;
  if app_private.retention_scope_enabled(retention_config, 'notificationExpiry') then
  if app_private.retention_boolean(retention_config, 'notificationsEnabled') then
    with targets as (
      select id from app_private.notifications
      where expires_at is distinct from created_at + make_interval(days => notifications_days)
      order by id limit limited
    ), updated as (
      update app_private.notifications set expires_at = created_at + make_interval(days => notifications_days)
      where id in (select id from targets) returning 1
    ) select count(*) into changed from updated;
  else
    with targets as (
      select id from app_private.notifications where expires_at is distinct from 'infinity'::timestamptz
      order by id limit limited
    ), retained as (
      update app_private.notifications set expires_at = 'infinity'::timestamptz
      where id in (select id from targets) returning 1
    ) select count(*) into changed from retained;
    details := details || jsonb_build_object('notifications', 0);
  end if;
  total_changed := total_changed + changed;
  has_more := has_more or changed = limited;
  details := details || jsonb_build_object('notificationExpiry', changed);
  end if;

  if app_private.retention_scope_enabled(retention_config, 'closedIssues') then
  -- 7. Closed issues
  if app_private.retention_boolean(retention_config, 'closedIssuesEnabled') then
    with targets as (
      select id, author_uid, category, title from app_private.issues
      where status in ('auto-rejected', 'review-rejected', 'infeasible', 'completed')
        and closed_at < now() - make_interval(days => closed_issue_days)
      order by id limit limited
    ), queued_events as (
      insert into app_private.domain_events(event_id, event_type, aggregate_type, aggregate_id, actor_uid, payload, operation_id)
      select
        gen_random_uuid(),
        'issue.deleted',
        'issue',
        target.id::text,
        target.author_uid,
        jsonb_build_object(
          'author_uid', target.author_uid,
          'issue_category', target.category,
          'issue_id', target.id,
          'retention_cleanup', true,
          'title', target.title
        ),
        cleanup_operation_id
      from targets target
      where exists(select 1 from app_private.notion_pages where target_type = 'issue' and target_id = target.id::text)
      returning event_id
    ), queued_deliveries as (
      insert into app_private.event_deliveries(event_id, destination)
      select event_id, 'notion' from queued_events
      returning 1
    ), deleted as (
      delete from app_private.issues where id in (select id from targets) returning 1
    ) select count(*) into changed from deleted;
    total_changed := total_changed + changed;
    has_more := has_more or changed = limited;
    details := details || jsonb_build_object('closedIssues', changed);
  end if;
  end if;

  if app_private.retention_scope_enabled(retention_config, 'closedFacilities') then
  -- 8. Closed facilities
  if app_private.retention_boolean(retention_config, 'closedFacilitiesEnabled') then
    with targets as (
      select id, author_uid, title from app_private.facility_reports
      where status in ('completed', 'unable-to-handle')
        and closed_at < now() - make_interval(days => closed_facility_days)
      order by id limit limited
    ), queued_events as (
      insert into app_private.domain_events(event_id, event_type, aggregate_type, aggregate_id, actor_uid, payload, operation_id)
      select
        gen_random_uuid(),
        'facility.deleted',
        'facility',
        target.id::text,
        target.author_uid,
        jsonb_build_object(
          'author_uid', target.author_uid,
          'retention_cleanup', true,
          'title', target.title
        ),
        cleanup_operation_id
      from targets target
      where exists(select 1 from app_private.notion_pages where target_type = 'facility' and target_id = target.id::text)
      returning event_id
    ), queued_deliveries as (
      insert into app_private.event_deliveries(event_id, destination)
      select event_id, 'notion' from queued_events
      returning 1
    ), deleted as (
      delete from app_private.facility_reports where id in (select id from targets) returning 1
    ) select count(*) into changed from deleted;
    total_changed := total_changed + changed;
    has_more := has_more or changed = limited;
    details := details || jsonb_build_object('closedFacilities', changed);
  end if;
  end if;

  if app_private.retention_scope_enabled(retention_config, 'announcements') then
  -- 9. Announcements
  if app_private.retention_boolean(retention_config, 'announcementsEnabled') then
    with targets as (
      select id from app_private.announcements
      where published_at < now() - make_interval(days => announcement_days)
      order by id limit limited
    ), deleted as (
      delete from app_private.announcements where id in (select id from targets) returning 1
    ) select count(*) into changed from deleted;
    total_changed := total_changed + changed;
    has_more := has_more or changed = limited;
    details := details || jsonb_build_object('announcements', changed);
  end if;
  end if;

  if app_private.retention_scope_enabled(retention_config, 'pendingUploads') or app_private.retention_scope_enabled(retention_config, 'unattachedUploads') or app_private.retention_scope_enabled(retention_config, 'failedUploads') then
  -- 10. Uploads
  with targets as (
    select id, cloudinary_public_id from app_private.uploads
    where cloudinary_public_id is not null
      and (
        (app_private.retention_scope_enabled(retention_config, 'pendingUploads') and status = 'pending' and created_at < now() - make_interval(hours => pending_upload_hours))
        or (app_private.retention_scope_enabled(retention_config, 'unattachedUploads') and status = 'ready' and attached_target_id is null and updated_at < now() - make_interval(hours => unattached_upload_hours))
        or (app_private.retention_scope_enabled(retention_config, 'failedUploads') and status = 'failed' and updated_at < now() - make_interval(hours => failed_upload_hours))
      )
    order by id limit limited
  ), queued as (
    insert into app_private.background_jobs(job_type, scope_id, payload, created_by)
    select 'deletion', id::text, jsonb_build_object('target_type', 'upload', 'target_id', id::text, 'cloudinary_public_id', cloudinary_public_id), 'retention_cleanup'
    from targets
    returning 1
  ), deleted as (
    delete from app_private.uploads where id in (select id from targets) returning 1
  ) select count(*) into changed from deleted;
  total_changed := total_changed + changed;
  has_more := has_more or changed = limited;
  details := details || jsonb_build_object('uploads', changed);
  end if;

  if app_private.retention_scope_enabled(retention_config, 'inactiveAvatars') then
  -- 11. Inactive avatars
  if app_private.retention_boolean(retention_config, 'inactiveAvatarsEnabled') then
    with targets as (
      select profile.uid, profile.avatar_public_id
      from app_private.user_profiles profile
      where avatar_public_id is not null
        and coalesce(last_seen_at, created_at) < now() - make_interval(days => inactive_avatar_days)
        and not exists(select 1 from app_private.issues where author_uid = profile.uid)
        and not exists(select 1 from app_private.comments where author_uid = profile.uid)
        and not exists(select 1 from app_private.facility_reports where author_uid = profile.uid)
        and not exists(select 1 from app_private.announcements where author_uid = profile.uid)
        and not exists(select 1 from app_private.announcement_comments where author_uid = profile.uid)
      order by uid limit limited
    ), cleared as (
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
      from targets
      where profile.uid = targets.uid
      returning profile.uid, targets.avatar_public_id
    ), queued as (
      insert into app_private.background_jobs(job_type, scope_id, payload, created_by)
      select 'deletion', uid, jsonb_build_object('target_type', 'avatar', 'target_id', uid, 'cloudinary_public_id', avatar_public_id), 'retention_cleanup'
      from cleared
      returning 1
    ) select count(*) into changed from cleared;
    total_changed := total_changed + changed;
    has_more := has_more or changed = limited;
    details := details || jsonb_build_object('inactiveAvatars', changed);
  end if;
  end if;

  if app_private.retention_scope_enabled(retention_config, 'categoryConfigurationAudit') then
  -- 13. Category configuration audit
  with targets as (
    select id from app_private.category_configuration_audit
    where created_at < now() - make_interval(days => category_audit_days)
    order by id limit limited
  ), deleted as (
    delete from app_private.category_configuration_audit where id in (select id from targets) returning 1
  ) select count(*) into changed from deleted;
  total_changed := total_changed + changed;
  has_more := has_more or changed = limited;
  details := details || jsonb_build_object('categoryConfigurationAudit', changed);
  end if;

  if app_private.retention_scope_enabled(retention_config, 'accessAssignmentAudit') then
  -- 14. Access assignment audit
  with targets as (
    select id from app_private.access_assignment_audit
    where created_at < now() - make_interval(days => access_audit_days)
    order by id limit limited
  ), deleted as (
    delete from app_private.access_assignment_audit where id in (select id from targets) returning 1
  ) select count(*) into changed from deleted;
  total_changed := total_changed + changed;
  has_more := has_more or changed = limited;
  details := details || jsonb_build_object('accessAssignmentAudit', changed);
  end if;

  return jsonb_build_object('affectedRows', total_changed, 'hasMore', has_more, 'details', details);
end;
$$;

create or replace function app_private.run_content_retention_batch(
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

  if app_private.retention_scope_enabled(retention_config, 'inactiveProfilePii') and app_private.retention_boolean(retention_config,'inactiveProfilePiiEnabled') then
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



  if app_private.retention_scope_enabled(retention_config, 'roleAssignmentAudit') then
  with targets as (
    select id from app_private.role_assignment_audit
    where created_at<now()-make_interval(days=>role_audit_days)
    order by id limit limited
  ), deleted as (
    delete from app_private.role_assignment_audit where id in(select id from targets) returning 1
  ) select count(*) into changed from deleted;
  total_changed:=total_changed+changed;
  details:=details || jsonb_build_object('roleAssignmentAudit', changed);
  has_more:=has_more or changed=limited;
  end if;

  if app_private.retention_scope_enabled(retention_config, 'adminAudit') then
  with targets as (
    select id from app_private.admin_audit_log
    where created_at<now()-make_interval(days=>admin_audit_days)
    order by id limit limited
  ), deleted as (
    delete from app_private.admin_audit_log where id in(select id from targets) returning 1
  ) select count(*) into changed from deleted;
  total_changed:=total_changed+changed;
  details:=details || jsonb_build_object('adminAudit', changed);
  has_more:=has_more or changed=limited;
  end if;

  -- Resolve orphan mappings after content and audit records were removed.
  if app_private.retention_scope_enabled(retention_config, 'notionMappings') then
    with targets as (
      select target_type, target_id from app_private.notion_pages page
      where (target_type='announcement' and not exists(select 1 from app_private.announcements where id::text=page.target_id))
        or (target_type='admin-audit' and not exists(select 1 from app_private.admin_audit_log where id::text=page.target_id))
        or (target_type='issue' and not exists(select 1 from app_private.issues where id::text=page.target_id))
        or (target_type='facility' and not exists(select 1 from app_private.facility_reports where id::text=page.target_id))
      order by target_type, target_id limit limited
    ), removed as (
      delete from app_private.notion_pages page using targets
      where page.target_type=targets.target_type and page.target_id=targets.target_id returning 1
    ) select count(*) into changed from removed;
    total_changed:=total_changed+changed;
    has_more:=has_more or changed=limited;
    details:=details || jsonb_build_object('notionMappings', changed);
  end if;

  return jsonb_build_object('affectedRows',total_changed,'hasMore',has_more,'details',details);
end;
$$;

create or replace function app_private.run_retention_cleanup_batch(retention_config jsonb, batch_size integer default 100)
returns jsonb language plpgsql security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
declare
  limited integer := least(greatest(batch_size, 1), 500);
  event_days integer := app_private.retention_integer(retention_config, 'domainEventDays');
  event_count integer := 0;
  response_count integer := 0;
  result jsonb;
begin
  if app_private.retention_scope_enabled(retention_config, 'operationResponses') then
  with targets as (
    select operation.operation_id from app_private.operations operation
    where status='completed' and not response_expired
      and expires_at < now()
      and (exists(select 1 from app_private.domain_events where operation_id=operation.operation_id)
        or exists(select 1 from app_private.admin_audit_log where operation_id=operation.operation_id))
    order by created_at limit limited for update skip locked
  ), compacted as (
    update app_private.operations set response=null,response_expired=true,updated_at=now()
    where operation_id in(select operation_id from targets) returning 1
  ) select count(*) into response_count from compacted;
  end if;
  if app_private.retention_scope_enabled(retention_config, 'domainEvents') then
  with targets as (
    select event.event_id from app_private.domain_events event
    where event.occurred_at < now() - make_interval(days => event_days)
      and not exists(select 1 from app_private.event_deliveries delivery where delivery.event_id = event.event_id)
    order by event.occurred_at limit limited
  ), removed as (
    delete from app_private.domain_events where event_id in (select event_id from targets) returning 1
  ) select count(*) into event_count from removed;

  end if;

  result := app_private.run_content_retention_batch(retention_config, limited);
  return result || jsonb_build_object(
    'affectedRows', (result->>'affectedRows')::integer + event_count + response_count,
    'hasMore', (result->>'hasMore')::boolean or event_count = limited or response_count = limited,
    'details', (result->'details') || jsonb_build_object('domainEvents', event_count,'operationResponses',response_count)
  );
end;
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
  updated_count bigint := 0;
  deleted_count bigint;
  notification_deadline timestamptz;
  closed_issue_days integer := app_private.retention_integer(retention_config, 'closedIssuesDays');
  closed_facility_days integer := app_private.retention_integer(retention_config, 'closedFacilitiesDays');
  announcement_days integer := app_private.retention_integer(retention_config, 'announcementsDays');
  notifications_days integer := app_private.retention_integer(retention_config, 'notificationsDays');
  inactive_push_days integer := app_private.retention_integer(retention_config, 'inactivePushTokensDays');
  inactive_avatar_days integer := app_private.retention_integer(retention_config, 'inactiveAvatarsDays');
  inactive_pii_days integer := app_private.retention_integer(retention_config, 'inactiveProfilePiiDays');
  restriction_days integer := app_private.retention_integer(retention_config, 'expiredRestrictionsDays');
  role_audit_days integer := app_private.retention_integer(retention_config, 'roleAssignmentAuditDays');
  admin_audit_days integer := app_private.retention_integer(retention_config, 'adminAuditDays');
  category_audit_days integer := app_private.retention_integer(retention_config, 'categoryConfigurationAuditDays');
  access_audit_days integer := app_private.retention_integer(retention_config, 'accessAssignmentAuditDays');
  pending_upload_hours integer := app_private.retention_integer(retention_config, 'pendingUploadHours');
  unattached_upload_hours integer := app_private.retention_integer(retention_config, 'unattachedUploadHours');
  failed_upload_hours integer := app_private.retention_integer(retention_config, 'failedUploadHours');
begin
  perform app_private.assert_retention_config(retention_config);
  details := '{}'::jsonb;
  if app_private.retention_scope_enabled(retention_config, 'closedIssues') then
    details := details || jsonb_build_object('closedIssues', (select count(*) from app_private.issues where app_private.retention_boolean(retention_config, 'closedIssuesEnabled') and status in ('auto-rejected', 'review-rejected', 'infeasible', 'completed') and closed_at < now() - make_interval(days => closed_issue_days)));
  end if;
  if app_private.retention_scope_enabled(retention_config, 'closedFacilities') then
    details := details || jsonb_build_object('closedFacilities', (select count(*) from app_private.facility_reports where app_private.retention_boolean(retention_config, 'closedFacilitiesEnabled') and status in ('completed', 'unable-to-handle') and closed_at < now() - make_interval(days => closed_facility_days)));
  end if;
  if app_private.retention_scope_enabled(retention_config, 'announcements') then
    details := details || jsonb_build_object('announcements', (select count(*) from app_private.announcements where app_private.retention_boolean(retention_config, 'announcementsEnabled') and published_at < now() - make_interval(days => announcement_days)));
  end if;
  if app_private.retention_scope_enabled(retention_config, 'inactiveAvatars') then
    details := details || jsonb_build_object('inactiveAvatars', (select count(*) from app_private.user_profiles profile where app_private.retention_boolean(retention_config, 'inactiveAvatarsEnabled') and avatar_public_id is not null and coalesce(last_seen_at, created_at) < now() - make_interval(days => inactive_avatar_days) and not exists(select 1 from app_private.issues where author_uid = profile.uid) and not exists(select 1 from app_private.comments where author_uid = profile.uid) and not exists(select 1 from app_private.facility_reports where author_uid = profile.uid) and not exists(select 1 from app_private.announcements where author_uid = profile.uid) and not exists(select 1 from app_private.announcement_comments where author_uid = profile.uid)));
  end if;
  if app_private.retention_scope_enabled(retention_config, 'inactiveProfilePii') then
    details := details || jsonb_build_object('inactiveProfilePii', (select count(*) from app_private.user_profiles profile where app_private.retention_boolean(retention_config, 'inactiveProfilePiiEnabled') and coalesce(last_seen_at, created_at) < now() - make_interval(days => inactive_pii_days) and not exists(select 1 from app_private.user_role_assignments where uid = profile.uid) and not exists(select 1 from app_private.user_issue_category_assignments where uid = profile.uid) and not exists(select 1 from app_private.user_facility_category_assignments where uid = profile.uid) and (email is not null or (display_name is not null and not exists(select 1 from app_private.issues where author_uid = profile.uid) and not exists(select 1 from app_private.comments where author_uid = profile.uid) and not exists(select 1 from app_private.facility_reports where author_uid = profile.uid) and not exists(select 1 from app_private.announcements where author_uid = profile.uid) and not exists(select 1 from app_private.announcement_comments where author_uid = profile.uid)))));
  end if;
  if app_private.retention_scope_enabled(retention_config, 'restrictions') then
    details := details || jsonb_build_object('restrictions', (select count(*) from app_private.user_restrictions where app_private.retention_boolean(retention_config, 'expiredRestrictionsEnabled') and not restricted_permanently and restricted_until < now() - make_interval(days => restriction_days)));
  end if;
  if app_private.retention_scope_enabled(retention_config, 'operations') then
    details := details || jsonb_build_object('operations', (
      select count(*) from app_private.operations operation
      where operation.expires_at < now()
        and not exists(select 1 from app_private.domain_events event where event.operation_id=operation.operation_id)
        and not exists(select 1 from app_private.admin_audit_log audit where audit.operation_id=operation.operation_id)
    ));
  end if;
  if app_private.retention_scope_enabled(retention_config, 'eventDeliveries') then
    details := details || jsonb_build_object('eventDeliveries', (select count(*) from app_private.event_deliveries where (status = 'processing' and attempt_count >= 8 and locked_at < now() - interval '15 minutes') or (status in ('completed', 'failed') and expires_at < now())));
  end if;
  if app_private.retention_scope_enabled(retention_config, 'pushTokens') then
    details := details || jsonb_build_object('pushTokens', (select count(*) from app_private.push_tokens where permission <> 'granted' or last_confirmed_at < now() - make_interval(days => inactive_push_days)));
  end if;
  if app_private.retention_scope_enabled(retention_config, 'backgroundJobs') then
    details := details || jsonb_build_object('backgroundJobs', (select count(*) from app_private.background_jobs where (status = 'processing' and attempt_count >= 8 and locked_at < now() - interval '15 minutes') or (status in ('completed', 'failed', 'superseded') and expires_at < now())));
  end if;
  if app_private.retention_scope_enabled(retention_config, 'notionMappings') then
    details := details || jsonb_build_object('notionMappings', (select count(*) from app_private.notion_pages page where (target_type = 'announcement' and not exists(select 1 from app_private.announcements where id::text = page.target_id)) or (target_type = 'admin-audit' and not exists(select 1 from app_private.admin_audit_log where id::text = page.target_id)) or (target_type = 'issue' and not exists(select 1 from app_private.issues where id::text = page.target_id)) or (target_type = 'facility' and not exists(select 1 from app_private.facility_reports where id::text = page.target_id))));
  end if;
  if app_private.retention_scope_enabled(retention_config, 'roleAssignmentAudit') then
    details := details || jsonb_build_object('roleAssignmentAudit', (select count(*) from app_private.role_assignment_audit where created_at < now() - make_interval(days => app_private.retention_integer(retention_config, 'roleAssignmentAuditDays'))));
  end if;
  if app_private.retention_scope_enabled(retention_config, 'adminAudit') then
    details := details || jsonb_build_object('adminAudit', (select count(*) from app_private.admin_audit_log where created_at < now() - make_interval(days => app_private.retention_integer(retention_config, 'adminAuditDays'))));
  end if;
  if app_private.retention_scope_enabled(retention_config, 'categoryConfigurationAudit') then
    details := details || jsonb_build_object('categoryConfigurationAudit', (select count(*) from app_private.category_configuration_audit where created_at < now() - make_interval(days => app_private.retention_integer(retention_config, 'categoryConfigurationAuditDays'))));
  end if;
  if app_private.retention_scope_enabled(retention_config, 'accessAssignmentAudit') then
    details := details || jsonb_build_object('accessAssignmentAudit', (select count(*) from app_private.access_assignment_audit where created_at < now() - make_interval(days => app_private.retention_integer(retention_config, 'accessAssignmentAuditDays'))));
  end if;
  if app_private.retention_scope_enabled(retention_config, 'pendingUploads') then
    details := details || jsonb_build_object('pendingUploads', (select count(*) from app_private.uploads where cloudinary_public_id is not null and status='pending'  and created_at < now()-make_interval(hours => app_private.retention_integer(retention_config, 'pendingUploadHours'))));
  end if;
  if app_private.retention_scope_enabled(retention_config, 'unattachedUploads') then
    details := details || jsonb_build_object('unattachedUploads', (select count(*) from app_private.uploads where cloudinary_public_id is not null and status='ready' and attached_target_id is null and updated_at < now()-make_interval(hours => app_private.retention_integer(retention_config, 'unattachedUploadHours'))));
  end if;
  if app_private.retention_scope_enabled(retention_config, 'failedUploads') then
    details := details || jsonb_build_object('failedUploads', (select count(*) from app_private.uploads where cloudinary_public_id is not null and status='failed'  and updated_at < now()-make_interval(hours => app_private.retention_integer(retention_config, 'failedUploadHours'))));
  end if;
  if app_private.retention_scope_enabled(retention_config, 'domainEvents') then
    details := details || jsonb_build_object('domainEvents', (select count(*) from app_private.domain_events event where occurred_at < now()-make_interval(days => app_private.retention_integer(retention_config, 'domainEventDays')) and not exists(select 1 from app_private.event_deliveries where event_id=event.event_id)));
  end if;
  if app_private.retention_scope_enabled(retention_config, 'operationResponses') then
    details := details || jsonb_build_object('operationResponses', (select count(*) from app_private.operations operation where status='completed' and not response_expired and expires_at < now() and (exists(select 1 from app_private.domain_events where operation_id=operation.operation_id) or exists(select 1 from app_private.admin_audit_log where operation_id=operation.operation_id))));
  end if;
  notification_deadline := now() - make_interval(days => notifications_days);
  if app_private.retention_scope_enabled(retention_config, 'notifications')
    and app_private.retention_boolean(retention_config, 'notificationsEnabled') then
    select count(*) into deleted_count from app_private.notifications where created_at < notification_deadline;
    details := details || jsonb_build_object('notifications', deleted_count);
  end if;
  if app_private.retention_scope_enabled(retention_config, 'notificationExpiry') then
    if app_private.retention_boolean(retention_config, 'notificationsEnabled') then
      select count(*) into updated_count from app_private.notifications
      where (not app_private.retention_scope_enabled(retention_config, 'notifications') or created_at >= notification_deadline)
        and expires_at is distinct from created_at + make_interval(days => notifications_days);
    else
      select count(*) into updated_count from app_private.notifications where expires_at is distinct from 'infinity'::timestamptz;
    end if;
  end if;
  select coalesce(sum(value::text::bigint), 0) into total from jsonb_each(details);
  return jsonb_build_object('details', details, 'updatedDetails', jsonb_build_object('notificationExpiry', updated_count),
    'totalDeletedRows', total, 'totalUpdatedRows', updated_count, 'totalEstimatedRows', total + updated_count);
end;
$$;

create or replace function app_private.enqueue_policy_job(
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
  estimate bigint := 0;
  next_id uuid;
  next_status text;
  canonical_job_type text := case when job_type = 'retention-cleanup' then 'retention_cleanup' else 'category_policy' end;
  canonical_payload jsonb := coalesce(payload, '{}'::jsonb) || jsonb_build_object('policyType', job_type);
begin
  estimate := app_private.policy_job_estimate(job_type, scope_id, payload);

  update app_private.background_jobs
  set status = 'superseded',
      completed_at = now(),
      updated_at = now(),
      locked_at = null,
      result = jsonb_build_object('reason', 'replaced-by-newer-policy')
  where background_jobs.job_type = canonical_job_type
    and background_jobs.scope_id = enqueue_policy_job.scope_id
    and background_jobs.payload->>'policyType' = enqueue_policy_job.job_type
    and status in ('pending', 'processing', 'failed');

  next_status := case when estimate = 0 then 'completed' else 'pending' end;
  insert into app_private.background_jobs(
    job_type, scope_id, payload, status, estimated_rows, created_by, completed_at, result
  ) values (
    canonical_job_type,
    scope_id,
    canonical_payload,
    next_status,
    estimate,
    coalesce(nullif(actor_uid, ''), 'system'),
    case when estimate = 0 then now() else null end,
    case when estimate = 0 then jsonb_build_object('affectedRows', 0) else '{}'::jsonb end
  ) returning id into next_id;

  return next_id;
end;
$$;

create or replace function app_api.backend_estimate_retention_cleanup(actor_uid text, retention_config jsonb)
returns jsonb language plpgsql stable security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
begin
  if not app_private.actor_has_permission(actor_uid, 'category.manage') then raise exception 'permission-denied'; end if;
  perform app_private.assert_retention_config(retention_config);
  return app_private.retention_cleanup_estimate(retention_config || jsonb_build_object('cleanupScopes',
    app_private.retention_change_scopes(app_private.runtime_retention_config(), retention_config)));
end;
$$;


create or replace function app_api.backend_save_platform_settings(actor_uid text, image_settings jsonb, retention_config jsonb)
returns jsonb language plpgsql security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
declare
  previous_retention jsonb; previous_images jsonb; scopes jsonb; scoped_config jsonb;
  impact jsonb; job_id uuid;
begin
  if not app_private.actor_has_permission(actor_uid, 'category.manage') then raise exception 'permission-denied'; end if;
  perform app_private.assert_retention_config(retention_config);
  perform pg_advisory_xact_lock(hashtext('novae:platform-settings'));
  previous_retention := app_private.runtime_retention_config();
  select value::jsonb into previous_images from app_private.runtime_settings where key = 'image_upload_settings';
  scopes := app_private.retention_change_scopes(previous_retention, retention_config);
  scoped_config := retention_config || jsonb_build_object('cleanupScopes', scopes);
  impact := app_private.retention_cleanup_estimate(scoped_config);
  if previous_retention is distinct from retention_config then
    update app_private.background_jobs set status = 'superseded', locked_at = null, completed_at = now(), updated_at = now(),
      result = jsonb_build_object('reason', 'replaced-by-newer-policy')
    where job_type = 'retention_cleanup' and status in ('pending', 'processing', 'failed');
  end if;
  insert into app_private.runtime_settings(key, value, updated_at) values
    ('image_upload_settings', image_settings::text, now()), ('data_retention_settings', retention_config::text, now())
  on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at;
  if (impact->>'totalEstimatedRows')::bigint > 0 then
    job_id := app_private.enqueue_policy_job('retention-cleanup', 'global', scoped_config, actor_uid);
  end if;
  if previous_retention is distinct from retention_config or previous_images is distinct from image_settings then
    insert into app_private.category_configuration_audit(domain, operation, actor_uid, before_value, after_value)
    values ('platform', 'update-platform-settings', actor_uid,
      jsonb_build_object('imageUploads', previous_images, 'retention', previous_retention),
      jsonb_build_object('imageUploads', image_settings, 'retention', retention_config));
  end if;
  return impact || jsonb_build_object('jobId', job_id, 'estimatedRows', (impact->>'totalEstimatedRows')::bigint);
end;
$$;



revoke all on function app_private.retention_scope_enabled(jsonb, text) from public;
revoke all on function app_private.retention_change_scopes(jsonb, jsonb) from public;
grant execute on function app_private.retention_scope_enabled(jsonb, text) to novae_runtime;
grant execute on function app_private.retention_change_scopes(jsonb, jsonb) to novae_runtime;
-- Existing functions retain their privileges under CREATE OR REPLACE.
update app_private.background_jobs set status='superseded', locked_at=null, completed_at=now(), updated_at=now(),
  result=jsonb_build_object('reason','obsolete-retention-policy')
where job_type='retention_cleanup' and status in ('pending','processing','failed')
  and (payload - 'policyType' - 'cleanupScopes') is distinct from app_private.runtime_retention_config();
