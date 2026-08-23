update app_private.runtime_settings
set value = (
  '{
    "closedIssuesEnabled":true,
    "closedIssuesDays":365,
    "closedFacilitiesEnabled":true,
    "closedFacilitiesDays":365,
    "announcementsEnabled":true,
    "announcementsDays":730,
    "notificationsEnabled":true,
    "notificationsDays":30,
    "realtimeEventsHours":3,
    "outboxCompletedDays":3,
    "outboxFailedDays":14,
    "pushDeliverySentDays":1,
    "pushDeliveryFailedDays":7,
    "idempotencyHours":24,
    "inactivePushTokensDays":60,
    "pushTokenConfirmationDays":7,
    "inactiveAvatarsEnabled":true,
    "inactiveAvatarsDays":180,
    "inactiveProfilePiiEnabled":true,
    "inactiveProfilePiiDays":365,
    "expiredRestrictionsEnabled":true,
    "expiredRestrictionsDays":30,
    "deletionJobCompletedDays":3,
    "deletionJobFailedDays":30,
    "maintenanceRunsDays":30,
    "platformJobsDays":30,
    "roleAssignmentAuditDays":365,
    "categoryConfigurationAuditDays":365,
    "accessAssignmentAuditDays":365,
    "pendingUploadHours":24,
    "unattachedUploadHours":48,
    "failedUploadHours":24
  }'::jsonb || coalesce(nullif(value, '')::jsonb, '{}'::jsonb)
)::text,
updated_at = now()
where key = 'data_retention_settings';

alter table app_private.category_configuration_audit
  drop constraint category_configuration_audit_domain_check,
  drop constraint category_configuration_audit_operation_check,
  add constraint category_configuration_audit_domain_check
    check (domain in ('issue','facility','setup','platform')),
  add constraint category_configuration_audit_operation_check
    check (operation in ('create','update','archive','restore','delete','complete-setup','update-features','update-retention'));

create function app_private.retention_cleanup_estimate(retention_config jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'app_private', 'public'
as $$
declare
  details jsonb;
  total bigint;
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
  inactive_push_days integer := greatest(1, least(3650, coalesce((retention_config->>'inactivePushTokensDays')::integer, 60)));
  inactive_avatar_days integer := greatest(1, least(3650, coalesce((retention_config->>'inactiveAvatarsDays')::integer, 180)));
  inactive_pii_days integer := greatest(1, least(3650, coalesce((retention_config->>'inactiveProfilePiiDays')::integer, 365)));
  restriction_days integer := greatest(1, least(3650, coalesce((retention_config->>'expiredRestrictionsDays')::integer, 30)));
  deletion_completed_days integer := greatest(1, least(3650, coalesce((retention_config->>'deletionJobCompletedDays')::integer, 3)));
  deletion_failed_days integer := greatest(1, least(3650, coalesce((retention_config->>'deletionJobFailedDays')::integer, 30)));
  maintenance_days integer := greatest(1, least(3650, coalesce((retention_config->>'maintenanceRunsDays')::integer, 30)));
  platform_job_days integer := greatest(1, least(3650, coalesce((retention_config->>'platformJobsDays')::integer, 30)));
  role_audit_days integer := greatest(1, least(3650, coalesce((retention_config->>'roleAssignmentAuditDays')::integer, 365)));
  category_audit_days integer := greatest(1, least(3650, coalesce((retention_config->>'categoryConfigurationAuditDays')::integer, 365)));
  access_audit_days integer := greatest(1, least(3650, coalesce((retention_config->>'accessAssignmentAuditDays')::integer, 365)));
  pending_upload_hours integer := greatest(1, least(87600, coalesce((retention_config->>'pendingUploadHours')::integer, 24)));
  unattached_upload_hours integer := greatest(1, least(87600, coalesce((retention_config->>'unattachedUploadHours')::integer, 48)));
  failed_upload_hours integer := greatest(1, least(87600, coalesce((retention_config->>'failedUploadHours')::integer, 24)));
begin
  select jsonb_build_object(
    'closedIssues', (select count(*) from app_private.issues where coalesce((retention_config->>'closedIssuesEnabled')::boolean, true) and status in ('auto-rejected','review-rejected','infeasible','completed') and closed_at < now() - make_interval(days => closed_issue_days)),
    'closedFacilities', (select count(*) from app_private.facility_reports where coalesce((retention_config->>'closedFacilitiesEnabled')::boolean, true) and status in ('completed','unable-to-handle') and closed_at < now() - make_interval(days => closed_facility_days)),
    'announcements', (select count(*) from app_private.announcements where coalesce((retention_config->>'announcementsEnabled')::boolean, true) and published_at < now() - make_interval(days => announcement_days)),
    'uploads', (select count(*) from app_private.uploads where cloudinary_public_id is not null and ((status='pending' and created_at < now()-make_interval(hours=>pending_upload_hours)) or (status='ready' and attached_target_id is null and updated_at < now()-make_interval(hours=>unattached_upload_hours)) or (status='failed' and updated_at < now()-make_interval(hours=>failed_upload_hours)))),
    'inactiveAvatars', (select count(*) from app_private.user_profiles profile where coalesce((retention_config->>'inactiveAvatarsEnabled')::boolean, true) and avatar_public_id is not null and coalesce(last_seen_at,created_at) < now()-make_interval(days=>inactive_avatar_days) and not exists(select 1 from app_private.issues where author_uid=profile.uid) and not exists(select 1 from app_private.comments where author_uid=profile.uid) and not exists(select 1 from app_private.facility_reports where author_uid=profile.uid) and not exists(select 1 from app_private.announcements where author_uid=profile.uid) and not exists(select 1 from app_private.announcement_comments where author_uid=profile.uid)),
    'inactiveProfilePii', (select count(*) from app_private.user_profiles profile where coalesce((retention_config->>'inactiveProfilePiiEnabled')::boolean, true) and (email is not null or display_name is not null) and coalesce(last_seen_at,created_at) < now()-make_interval(days=>inactive_pii_days) and not exists(select 1 from app_private.user_role_assignments where uid=profile.uid) and not exists(select 1 from app_private.user_issue_category_assignments where uid=profile.uid) and not exists(select 1 from app_private.user_facility_category_assignments where uid=profile.uid)),
    'restrictions', (select count(*) from app_private.user_restrictions where coalesce((retention_config->>'expiredRestrictionsEnabled')::boolean, true) and not restricted_permanently and restricted_until < now()-make_interval(days=>restriction_days)),
    'notifications', (select count(*) from app_private.notifications where coalesce((retention_config->>'notificationsEnabled')::boolean, true) and (expires_at is distinct from created_at+make_interval(days=>notifications_days) or created_at+make_interval(days=>notifications_days) < now())),
    'realtime', (select count(*) from app_private.realtime_events where expires_at is distinct from created_at+make_interval(hours=>realtime_hours) or created_at+make_interval(hours=>realtime_hours) < now()),
    'outbox', (select count(*) from app_private.outbox_events where (status='processing' and attempt_count>=8 and locked_at < now()-interval '15 minutes') or (status in ('completed','failed') and (expires_at is distinct from updated_at+case status when 'completed' then make_interval(days=>outbox_completed_days) else make_interval(days=>outbox_failed_days) end or updated_at+case status when 'completed' then make_interval(days=>outbox_completed_days) else make_interval(days=>outbox_failed_days) end < now()))),
    'pushDeliveries', (select count(*) from app_private.push_delivery_logs where (status='processing' and attempt_count>=8 and locked_at < now()-interval '15 minutes') or (status='sent' and updated_at<now()-make_interval(days=>push_sent_days)) or (status='failed' and updated_at<now()-make_interval(days=>push_failed_days))),
    'idempotency', (select count(*) from app_private.idempotency_keys where expires_at is distinct from updated_at+make_interval(hours=>idempotency_hours) or updated_at+make_interval(hours=>idempotency_hours)<now()),
    'pushTokens', (select count(*) from app_private.push_tokens where permission<>'granted' or last_confirmed_at<now()-make_interval(days=>inactive_push_days)),
    'deletionJobs', (select count(*) from app_private.deletion_jobs where (status='processing' and attempt_count>=8 and locked_at<now()-interval '15 minutes') or (status='completed' and updated_at<now()-make_interval(days=>deletion_completed_days)) or (status='failed' and updated_at<now()-make_interval(days=>deletion_failed_days))),
    'auditLogs', (select (select count(*) from app_private.role_assignment_audit where created_at<now()-make_interval(days=>role_audit_days)) + (select count(*) from app_private.category_configuration_audit where created_at<now()-make_interval(days=>category_audit_days)) + (select count(*) from app_private.access_assignment_audit where created_at<now()-make_interval(days=>access_audit_days)) + (select count(*) from app_private.admin_audit_log where created_at<now()-make_interval(days=>role_audit_days))),
    'maintenanceRuns', (select count(*) from app_private.maintenance_runs where started_at<now()-make_interval(days=>maintenance_days)),
    'platformJobs', (select count(*) from app_private.platform_jobs where status in ('completed','failed','superseded') and updated_at<now()-make_interval(days=>platform_job_days))
  ) into details;

  select coalesce(sum(value::text::bigint), 0) into total from jsonb_each(details);
  return jsonb_build_object('details', details, 'totalEstimatedRows', total);
end;
$$;

create function app_private.run_retention_cleanup_batch(retention_config jsonb, batch_size integer default 100)
returns jsonb
language plpgsql
security definer
set search_path to 'app_private', 'public'
as $$
declare
  limited integer := least(greatest(coalesce(batch_size,100),1),500);
  changed integer := 0;
  total_changed integer := 0;
  has_more boolean := false;
  details jsonb := '{}'::jsonb;
  closed_issue_days integer := greatest(1,least(3650,coalesce((retention_config->>'closedIssuesDays')::integer,365)));
  closed_facility_days integer := greatest(1,least(3650,coalesce((retention_config->>'closedFacilitiesDays')::integer,365)));
  announcement_days integer := greatest(1,least(3650,coalesce((retention_config->>'announcementsDays')::integer,730)));
  notifications_days integer := greatest(1,least(3650,coalesce((retention_config->>'notificationsDays')::integer,30)));
  realtime_hours integer := greatest(1,least(87600,coalesce((retention_config->>'realtimeEventsHours')::integer,3)));
  outbox_completed_days integer := greatest(1,least(3650,coalesce((retention_config->>'outboxCompletedDays')::integer,3)));
  outbox_failed_days integer := greatest(1,least(3650,coalesce((retention_config->>'outboxFailedDays')::integer,14)));
  push_sent_days integer := greatest(1,least(3650,coalesce((retention_config->>'pushDeliverySentDays')::integer,1)));
  push_failed_days integer := greatest(1,least(3650,coalesce((retention_config->>'pushDeliveryFailedDays')::integer,7)));
  idempotency_hours integer := greatest(1,least(87600,coalesce((retention_config->>'idempotencyHours')::integer,24)));
  inactive_push_days integer := greatest(1,least(3650,coalesce((retention_config->>'inactivePushTokensDays')::integer,60)));
  inactive_avatar_days integer := greatest(1,least(3650,coalesce((retention_config->>'inactiveAvatarsDays')::integer,180)));
  inactive_pii_days integer := greatest(1,least(3650,coalesce((retention_config->>'inactiveProfilePiiDays')::integer,365)));
  restriction_days integer := greatest(1,least(3650,coalesce((retention_config->>'expiredRestrictionsDays')::integer,30)));
  deletion_completed_days integer := greatest(1,least(3650,coalesce((retention_config->>'deletionJobCompletedDays')::integer,3)));
  deletion_failed_days integer := greatest(1,least(3650,coalesce((retention_config->>'deletionJobFailedDays')::integer,30)));
  maintenance_days integer := greatest(1,least(3650,coalesce((retention_config->>'maintenanceRunsDays')::integer,30)));
  platform_job_days integer := greatest(1,least(3650,coalesce((retention_config->>'platformJobsDays')::integer,30)));
  role_audit_days integer := greatest(1,least(3650,coalesce((retention_config->>'roleAssignmentAuditDays')::integer,365)));
  category_audit_days integer := greatest(1,least(3650,coalesce((retention_config->>'categoryConfigurationAuditDays')::integer,365)));
  access_audit_days integer := greatest(1,least(3650,coalesce((retention_config->>'accessAssignmentAuditDays')::integer,365)));
  pending_upload_hours integer := greatest(1,least(87600,coalesce((retention_config->>'pendingUploadHours')::integer,24)));
  unattached_upload_hours integer := greatest(1,least(87600,coalesce((retention_config->>'unattachedUploadHours')::integer,48)));
  failed_upload_hours integer := greatest(1,least(87600,coalesce((retention_config->>'failedUploadHours')::integer,24)));
begin
  if coalesce((retention_config->>'closedIssuesEnabled')::boolean,true) then
    with targets as (select id,author_uid,category,title from app_private.issues where status in ('auto-rejected','review-rejected','infeasible','completed') and closed_at<now()-make_interval(days=>closed_issue_days) order by id limit limited), queued as (insert into app_private.outbox_events(event_type,target_type,target_id,actor_uid,payload) select 'issue.deleted','issue',target.id::text,target.author_uid,jsonb_build_object('author_uid',target.author_uid,'issue_category',target.category,'issue_id',target.id,'retention_cleanup',true,'title',target.title) from targets target where exists(select 1 from app_private.notion_pages where target_type='issue' and target_id=target.id::text) returning 1), deleted as (delete from app_private.issues where id in(select id from targets) returning 1) select count(*) into changed from deleted;
    total_changed:=total_changed+changed; has_more:=has_more or changed=limited; details:=details||jsonb_build_object('closedIssues',changed);
  end if;
  if coalesce((retention_config->>'closedFacilitiesEnabled')::boolean,true) then
    with targets as (select id,author_uid,title from app_private.facility_reports where status in ('completed','unable-to-handle') and closed_at<now()-make_interval(days=>closed_facility_days) order by id limit limited), queued as (insert into app_private.outbox_events(event_type,target_type,target_id,actor_uid,payload) select 'facility.deleted','facility',target.id::text,target.author_uid,jsonb_build_object('author_uid',target.author_uid,'retention_cleanup',true,'title',target.title) from targets target where exists(select 1 from app_private.notion_pages where target_type='facility' and target_id=target.id::text) returning 1), deleted as (delete from app_private.facility_reports where id in(select id from targets) returning 1) select count(*) into changed from deleted;
    total_changed:=total_changed+changed; has_more:=has_more or changed=limited; details:=details||jsonb_build_object('closedFacilities',changed);
  end if;
  if coalesce((retention_config->>'announcementsEnabled')::boolean,true) then
    with targets as (select id from app_private.announcements where published_at<now()-make_interval(days=>announcement_days) order by id limit limited), deleted as (delete from app_private.announcements where id in(select id from targets) returning 1) select count(*) into changed from deleted;
    total_changed:=total_changed+changed; has_more:=has_more or changed=limited; details:=details||jsonb_build_object('announcements',changed);
  end if;

  with targets as (select id,cloudinary_public_id from app_private.uploads where cloudinary_public_id is not null and ((status='pending' and created_at<now()-make_interval(hours=>pending_upload_hours)) or (status='ready' and attached_target_id is null and updated_at<now()-make_interval(hours=>unattached_upload_hours)) or (status='failed' and updated_at<now()-make_interval(hours=>failed_upload_hours))) order by id limit limited), queued as (insert into app_private.deletion_jobs(target_type,target_id,cloudinary_public_id) select 'upload',id::text,cloudinary_public_id from targets returning 1), deleted as (delete from app_private.uploads where id in(select id from targets) returning 1) select count(*) into changed from deleted;
  total_changed:=total_changed+changed; has_more:=has_more or changed=limited; details:=details||jsonb_build_object('uploads',changed);

  if coalesce((retention_config->>'inactiveAvatarsEnabled')::boolean,true) then
    with targets as (select profile.uid,profile.avatar_public_id from app_private.user_profiles profile where avatar_public_id is not null and coalesce(last_seen_at,created_at)<now()-make_interval(days=>inactive_avatar_days) and not exists(select 1 from app_private.issues where author_uid=profile.uid) and not exists(select 1 from app_private.comments where author_uid=profile.uid) and not exists(select 1 from app_private.facility_reports where author_uid=profile.uid) and not exists(select 1 from app_private.announcements where author_uid=profile.uid) and not exists(select 1 from app_private.announcement_comments where author_uid=profile.uid) order by uid limit limited), cleared as (update app_private.user_profiles profile set avatar_hash=null,avatar_public_id=null,avatar_source_url=null,avatar_checked_at=null,cached_photo_url=null,photo_url=null,avatar_version=profile.avatar_version+1,profile_version=profile.profile_version+1,updated_at=now() from targets where profile.uid=targets.uid returning profile.uid,targets.avatar_public_id), queued as (insert into app_private.deletion_jobs(target_type,target_id,cloudinary_public_id) select 'avatar',uid,avatar_public_id from cleared returning 1) select count(*) into changed from cleared;
    total_changed:=total_changed+changed; has_more:=has_more or changed=limited; details:=details||jsonb_build_object('inactiveAvatars',changed);
  end if;
  if coalesce((retention_config->>'inactiveProfilePiiEnabled')::boolean,true) then
    with targets as (select uid from app_private.user_profiles profile where (email is not null or display_name is not null) and coalesce(last_seen_at,created_at)<now()-make_interval(days=>inactive_pii_days) and not exists(select 1 from app_private.user_role_assignments where uid=profile.uid) and not exists(select 1 from app_private.user_issue_category_assignments where uid=profile.uid) and not exists(select 1 from app_private.user_facility_category_assignments where uid=profile.uid) order by uid limit limited), cleared as (update app_private.user_profiles profile set email=null,display_name=case when not exists(select 1 from app_private.issues where author_uid=profile.uid) and not exists(select 1 from app_private.comments where author_uid=profile.uid) and not exists(select 1 from app_private.facility_reports where author_uid=profile.uid) and not exists(select 1 from app_private.announcements where author_uid=profile.uid) and not exists(select 1 from app_private.announcement_comments where author_uid=profile.uid) then null else profile.display_name end,profile_version=profile.profile_version+1,updated_at=now() where uid in(select uid from targets) returning 1) select count(*) into changed from cleared;
    total_changed:=total_changed+changed; has_more:=has_more or changed=limited; details:=details||jsonb_build_object('inactiveProfilePii',changed);
  end if;
  if coalesce((retention_config->>'expiredRestrictionsEnabled')::boolean,true) then
    with targets as (select uid from app_private.user_restrictions where not restricted_permanently and restricted_until<now()-make_interval(days=>restriction_days) order by uid limit limited), deleted as (delete from app_private.user_restrictions where uid in(select uid from targets) returning 1) select count(*) into changed from deleted;
    total_changed:=total_changed+changed; has_more:=has_more or changed=limited; details:=details||jsonb_build_object('restrictions',changed);
  end if;

  if coalesce((retention_config->>'notificationsEnabled')::boolean,true) then
    with targets as (select id from app_private.notifications where expires_at is distinct from created_at+make_interval(days=>notifications_days) order by id limit limited), changed_rows as (update app_private.notifications set expires_at=created_at+make_interval(days=>notifications_days) where id in(select id from targets) returning 1) select count(*) into changed from changed_rows;
    total_changed:=total_changed+changed; has_more:=has_more or changed=limited;
    with targets as (select id from app_private.notifications where expires_at<now() order by id limit limited), deleted as (delete from app_private.notifications where id in(select id from targets) returning 1) select count(*) into changed from deleted;
    total_changed:=total_changed+changed; has_more:=has_more or changed=limited; details:=details||jsonb_build_object('notifications',changed);
  end if;
  with targets as (select id from app_private.realtime_events where expires_at is distinct from created_at+make_interval(hours=>realtime_hours) order by id limit limited), changed_rows as (update app_private.realtime_events set expires_at=created_at+make_interval(hours=>realtime_hours) where id in(select id from targets) returning 1) select count(*) into changed from changed_rows;
  total_changed:=total_changed+changed; has_more:=has_more or changed=limited;
  with targets as (select id from app_private.realtime_events where expires_at<now() order by id limit limited), deleted as (delete from app_private.realtime_events where id in(select id from targets) returning 1) select count(*) into changed from deleted;
  total_changed:=total_changed+changed; has_more:=has_more or changed=limited; details:=details||jsonb_build_object('realtime',changed);

  with targets as (select id from app_private.outbox_events where status='processing' and attempt_count>=8 and locked_at<now()-interval '15 minutes' order by id limit limited), changed_rows as (update app_private.outbox_events set status='failed',locked_at=null,updated_at=now() where id in(select id from targets) returning 1) select count(*) into changed from changed_rows;
  total_changed:=total_changed+changed; has_more:=has_more or changed=limited;
  with targets as (select id from app_private.outbox_events where status in ('completed','failed') and expires_at is distinct from updated_at+case status when 'completed' then make_interval(days=>outbox_completed_days) else make_interval(days=>outbox_failed_days) end order by id limit limited), changed_rows as (update app_private.outbox_events event set expires_at=event.updated_at+case event.status when 'completed' then make_interval(days=>outbox_completed_days) else make_interval(days=>outbox_failed_days) end where id in(select id from targets) returning 1) select count(*) into changed from changed_rows;
  total_changed:=total_changed+changed; has_more:=has_more or changed=limited;
  with targets as (select id from app_private.outbox_events where status in ('completed','failed') and expires_at<now() order by id limit limited), deleted as (delete from app_private.outbox_events where id in(select id from targets) returning 1) select count(*) into changed from deleted;
  total_changed:=total_changed+changed; has_more:=has_more or changed=limited; details:=details||jsonb_build_object('outbox',changed);

  with targets as (select id from app_private.push_delivery_logs where (status='processing' and attempt_count>=8 and locked_at<now()-interval '15 minutes') or (status='sent' and updated_at<now()-make_interval(days=>push_sent_days)) or (status='failed' and updated_at<now()-make_interval(days=>push_failed_days)) order by id limit limited), deleted as (delete from app_private.push_delivery_logs where id in(select id from targets) returning 1) select count(*) into changed from deleted;
  total_changed:=total_changed+changed; has_more:=has_more or changed=limited; details:=details||jsonb_build_object('pushDeliveries',changed);
  with targets as (select uid,action,request_id from app_private.idempotency_keys where expires_at is distinct from updated_at+make_interval(hours=>idempotency_hours) order by uid,action,request_id limit limited), changed_rows as (update app_private.idempotency_keys key set expires_at=key.updated_at+make_interval(hours=>idempotency_hours) from targets where key.uid=targets.uid and key.action=targets.action and key.request_id=targets.request_id returning 1) select count(*) into changed from changed_rows;
  total_changed:=total_changed+changed; has_more:=has_more or changed=limited;
  with targets as (select uid,action,request_id from app_private.idempotency_keys where expires_at<now() order by uid,action,request_id limit limited), deleted as (delete from app_private.idempotency_keys key using targets where key.uid=targets.uid and key.action=targets.action and key.request_id=targets.request_id returning 1) select count(*) into changed from deleted;
  total_changed:=total_changed+changed; has_more:=has_more or changed=limited; details:=details||jsonb_build_object('idempotency',changed);
  with targets as (select uid,device_id from app_private.push_tokens where permission<>'granted' or last_confirmed_at<now()-make_interval(days=>inactive_push_days) order by uid,device_id limit limited), deleted as (delete from app_private.push_tokens token using targets where token.uid=targets.uid and token.device_id=targets.device_id returning 1) select count(*) into changed from deleted;
  total_changed:=total_changed+changed; has_more:=has_more or changed=limited; details:=details||jsonb_build_object('pushTokens',changed);
  with targets as (select id from app_private.deletion_jobs where (status='processing' and attempt_count>=8 and locked_at<now()-interval '15 minutes') or (status='completed' and updated_at<now()-make_interval(days=>deletion_completed_days)) or (status='failed' and updated_at<now()-make_interval(days=>deletion_failed_days)) order by id limit limited), deleted as (delete from app_private.deletion_jobs where id in(select id from targets) returning 1) select count(*) into changed from deleted;
  total_changed:=total_changed+changed; has_more:=has_more or changed=limited; details:=details||jsonb_build_object('deletionJobs',changed);

  with targets as (select id from app_private.role_assignment_audit where created_at<now()-make_interval(days=>role_audit_days) order by id limit limited), deleted as (delete from app_private.role_assignment_audit where id in(select id from targets) returning 1) select count(*) into changed from deleted; total_changed:=total_changed+changed; has_more:=has_more or changed=limited;
  with targets as (select id from app_private.category_configuration_audit where created_at<now()-make_interval(days=>category_audit_days) order by id limit limited), deleted as (delete from app_private.category_configuration_audit where id in(select id from targets) returning 1) select count(*) into changed from deleted; total_changed:=total_changed+changed; has_more:=has_more or changed=limited;
  with targets as (select id from app_private.access_assignment_audit where created_at<now()-make_interval(days=>access_audit_days) order by id limit limited), deleted as (delete from app_private.access_assignment_audit where id in(select id from targets) returning 1) select count(*) into changed from deleted; total_changed:=total_changed+changed; has_more:=has_more or changed=limited;
  with targets as (select id from app_private.admin_audit_log where created_at<now()-make_interval(days=>role_audit_days) order by id limit limited), deleted as (delete from app_private.admin_audit_log where id in(select id from targets) returning 1) select count(*) into changed from deleted; total_changed:=total_changed+changed; has_more:=has_more or changed=limited; details:=details||jsonb_build_object('auditLogs',changed);
  with targets as (select id from app_private.maintenance_runs where started_at<now()-make_interval(days=>maintenance_days) order by id limit limited), deleted as (delete from app_private.maintenance_runs where id in(select id from targets) returning 1) select count(*) into changed from deleted; total_changed:=total_changed+changed; has_more:=has_more or changed=limited; details:=details||jsonb_build_object('maintenanceRuns',changed);
  with targets as (select id from app_private.platform_jobs where status in ('completed','failed','superseded') and updated_at<now()-make_interval(days=>platform_job_days) order by id limit limited), deleted as (delete from app_private.platform_jobs where id in(select id from targets) returning 1) select count(*) into changed from deleted; total_changed:=total_changed+changed; has_more:=has_more or changed=limited; details:=details||jsonb_build_object('platformJobs',changed);

  return jsonb_build_object('affectedRows',total_changed,'hasMore',has_more,'details',details);
end;
$$;

create or replace function app_private.policy_job_estimate(job_type text, scope_id text, payload jsonb)
returns bigint
language plpgsql
stable
security definer
set search_path to 'app_private', 'public'
as $$
declare estimated bigint; desired boolean:=coalesce((payload->>'enabled')::boolean,false);
begin
  if job_type='announcement-comments' then select count(*) into estimated from app_private.announcements where comments_enabled is distinct from desired;
  elsif job_type='issue-category-comments' then select count(*) into estimated from app_private.issues issue where issue.category=scope_id and issue.comments_enabled is distinct from (desired and issue.status not in ('completed','infeasible','review-rejected','auto-rejected'));
  elsif job_type='retention-cleanup' then estimated:=coalesce((app_private.retention_cleanup_estimate(payload)->>'totalEstimatedRows')::bigint,0);
  else raise exception 'validation-invalid'; end if;
  return estimated;
end;
$$;

create function app_api.backend_estimate_retention_cleanup(actor_uid text, retention_config jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'app_private','app_api','public'
as $$
begin
  if not app_private.actor_has_permission(actor_uid,'category.manage') then raise exception 'permission-denied'; end if;
  return app_private.retention_cleanup_estimate(retention_config);
end;
$$;

create function app_api.backend_save_platform_settings(actor_uid text, image_settings jsonb, retention_config jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'app_private','app_api','public'
as $$
declare job_id uuid; estimate bigint;
begin
  if not app_private.actor_has_permission(actor_uid,'category.manage') then raise exception 'permission-denied'; end if;
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

create or replace function app_api.run_scheduled_maintenance_cleanup(retention_config jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'app_private','app_api','public'
as $$
declare job_id uuid;
begin
  select id into job_id from app_private.platform_jobs where job_type='retention-cleanup' and scope_id='global' and status in ('pending','processing') order by created_at desc limit 1;
  if job_id is null then job_id:=app_private.enqueue_policy_job('retention-cleanup','global',coalesce(retention_config,'{}'::jsonb),'system'); end if;
  return jsonb_build_object(
    'result',jsonb_build_object('jobId',job_id),
    'dueWorkers',jsonb_build_object(
      'outbox',exists(select 1 from app_private.outbox_events event where event.attempt_count<8 and ((event.status in ('pending','failed') and event.next_attempt_at<=now()) or (event.status='processing' and event.locked_at<now()-interval '10 minutes'))),
      'deletion',exists(select 1 from app_private.deletion_jobs job where job.attempt_count<8 and ((job.status in ('pending','failed') and job.next_attempt_at<=now()) or (job.status='processing' and job.locked_at<now()-interval '10 minutes')))
    )
  );
end;
$$;

revoke all on function app_private.retention_cleanup_estimate(jsonb) from public;
revoke all on function app_private.run_retention_cleanup_batch(jsonb,integer) from public;
revoke all on function app_api.backend_estimate_retention_cleanup(text,jsonb) from public;
revoke all on function app_api.backend_save_platform_settings(text,jsonb,jsonb) from public;
