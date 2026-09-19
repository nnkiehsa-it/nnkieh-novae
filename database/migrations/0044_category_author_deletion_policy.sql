-- Make author deletion an explicit, category-scoped policy. Category managers
-- and platform administrators retain management deletion regardless of it.

ALTER TABLE app_private.issue_categories
  ADD COLUMN author_delete_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE app_private.facility_categories
  ADD COLUMN author_delete_enabled boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION app_api.backend_get_session_bootstrap_snapshot(
  actor_uid text,
  actor_is_admin boolean,
  actor_email text,
  actor_name text,
  actor_photo_url text,
  record_visit boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'app_private', 'app_api', 'public'
AS $function$
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
    'authorDeleteEnabled', category.author_delete_enabled,
    'authorVisible', category.author_visible,
    'commentsEnabled', category.comments_enabled,
    'id', category.id,
    'isDefault', category.is_default,
    'label', category.label,
    'readAccess', category.read_access,
    'sortOrder', category.sort_order,
    'supportDeadlineDays', category.support_deadline_days,
    'supportEnabled', category.support_enabled,
    'supportGoal', category.support_goal
  ) order by category.sort_order, category.created_at, category.id), '[]'::jsonb)
  into issue_categories
  from app_private.issue_categories category;

  select coalesce(jsonb_agg(jsonb_build_object(
    'authorDeleteEnabled', category.author_delete_enabled,
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
$function$;

CREATE OR REPLACE FUNCTION app_api.backend_save_category_management(
  actor_uid text,
  issue_categories jsonb,
  facility_categories jsonb,
  deleted_issue_category_ids text[],
  deleted_facility_category_ids text[],
  issues_enabled boolean,
  facilities_enabled boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'app_private', 'app_api', 'public'
AS $function$
declare
  category jsonb;
  before_value jsonb;
  deleted_id text;
  existing_issue app_private.issue_categories%rowtype;
  existing_facility app_private.facility_categories%rowtype;
  saved_value jsonb;
begin
  if jsonb_typeof(issue_categories) <> 'array'
    or jsonb_typeof(facility_categories) <> 'array'
    or deleted_issue_category_ids is null
    or deleted_facility_category_ids is null
    or (issues_enabled and jsonb_array_length(issue_categories) = 0)
    or (facilities_enabled and jsonb_array_length(facility_categories) = 0)
    or exists (
      select 1 from jsonb_array_elements(issue_categories) kept
      where kept->>'id' = any(deleted_issue_category_ids)
    )
    or exists (
      select 1 from jsonb_array_elements(facility_categories) kept
      where kept->>'id' = any(deleted_facility_category_ids)
    ) then
    raise exception 'validation-required';
  end if;

  perform 1 from app_private.system_setup where singleton for update;
  perform 1 from app_private.issue_categories for update;
  perform 1 from app_private.facility_categories for update;

  foreach deleted_id in array deleted_issue_category_ids loop
    perform app_api.backend_delete_issue_category(deleted_id, actor_uid);
  end loop;
  foreach deleted_id in array deleted_facility_category_ids loop
    perform app_api.backend_delete_facility_category(deleted_id, actor_uid);
  end loop;

  update app_private.issue_categories set is_default = false where is_default;
  for category in select value from jsonb_array_elements(issue_categories)
  loop
    select * into existing_issue from app_private.issue_categories where id = category->>'id';
    before_value := case when found then to_jsonb(existing_issue) else null end;
    if before_value is not null and (
      existing_issue.read_access <> category->>'readAccess'
      or existing_issue.author_visible <> (category->>'authorVisible')::boolean
    ) then
      raise exception 'immutable-category-policy';
    end if;

    insert into app_private.issue_categories as saved(
      id,label,read_access,author_visible,author_delete_enabled,
      support_enabled,support_goal,support_deadline_days,comments_enabled,
      is_active,is_default,sort_order,created_by,updated_at
    ) values(
      category->>'id',btrim(category->>'label'),category->>'readAccess',
      (category->>'authorVisible')::boolean,
      coalesce((category->>'authorDeleteEnabled')::boolean,false),
      (category->>'supportEnabled')::boolean,
      nullif(category->>'supportGoal','')::integer,
      nullif(category->>'supportDeadlineDays','')::integer,
      (category->>'commentsEnabled')::boolean,true,
      (category->>'isDefault')::boolean,(category->>'sortOrder')::integer,
      coalesce(existing_issue.created_by,actor_uid),now()
    ) on conflict(id) do update set
      label=excluded.label,
      author_delete_enabled=excluded.author_delete_enabled,
      support_enabled=excluded.support_enabled,
      support_goal=excluded.support_goal,
      support_deadline_days=excluded.support_deadline_days,
      comments_enabled=excluded.comments_enabled,
      is_active=true,is_default=excluded.is_default,
      sort_order=excluded.sort_order,updated_at=now()
    returning to_jsonb(saved) into saved_value;

    insert into app_private.category_configuration_audit(
      actor_uid,category_id,domain,operation,before_value,after_value
    ) values(
      actor_uid,category->>'id','issue',
      case when before_value is null then 'create' else 'update' end,
      before_value,saved_value
    );
  end loop;

  update app_private.facility_categories set is_default = false where is_default;
  for category in select value from jsonb_array_elements(facility_categories)
  loop
    select * into existing_facility from app_private.facility_categories where id = category->>'id';
    before_value := case when found then to_jsonb(existing_facility) else null end;

    insert into app_private.facility_categories as saved(
      id,label,author_delete_enabled,is_active,is_default,sort_order,created_by,updated_at
    ) values(
      category->>'id',btrim(category->>'label'),
      coalesce((category->>'authorDeleteEnabled')::boolean,false),true,
      (category->>'isDefault')::boolean,(category->>'sortOrder')::integer,
      coalesce(existing_facility.created_by,actor_uid),now()
    ) on conflict(id) do update set
      label=excluded.label,
      author_delete_enabled=excluded.author_delete_enabled,
      is_active=true,is_default=excluded.is_default,
      sort_order=excluded.sort_order,updated_at=now()
    returning to_jsonb(saved) into saved_value;

    insert into app_private.category_configuration_audit(
      actor_uid,category_id,domain,operation,before_value,after_value
    ) values(
      actor_uid,category->>'id','facility',
      case when before_value is null then 'create' else 'update' end,
      before_value,saved_value
    );
  end loop;

  perform app_api.backend_update_platform_features(
    actor_uid,issues_enabled,facilities_enabled
  );
  return jsonb_build_object('success',true);
end;
$function$;

DROP FUNCTION app_api.backend_delete_facility(uuid, text, boolean);

CREATE FUNCTION app_api.backend_delete_facility(
  facility_id uuid,
  actor_uid text,
  actor_can_manage boolean,
  author_delete_enabled boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'app_private', 'app_api', 'public'
AS $function$
declare
  report_record app_private.facility_reports%rowtype;
begin
  select * into report_record
  from app_private.facility_reports where id = facility_id for update;
  if not found then return jsonb_build_object('success', true); end if;
  if not actor_can_manage
    and not (author_delete_enabled and report_record.author_uid = actor_uid)
  then
    raise exception 'permission-denied';
  end if;

  delete from app_private.notifications notification
  where notification.target_type = 'facility' and notification.target_id = report_record.id::text;
  delete from app_private.facility_reports where id = report_record.id;
  return jsonb_build_object('success', true);
end;
$function$;

DROP FUNCTION app_api.backend_delete_issue_with_upload_targets(uuid, text, boolean);

CREATE FUNCTION app_api.backend_delete_issue_with_upload_targets(
  issue_id uuid,
  actor_uid text,
  actor_can_manage boolean,
  author_delete_enabled boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'app_private', 'app_api', 'public'
AS $function$
declare
  issue_record app_private.issues%rowtype;
  upload_targets jsonb;
  supporter_uids jsonb;
begin
  select * into issue_record
  from app_private.issues
  where id = backend_delete_issue_with_upload_targets.issue_id
  for update;

  if not found then
    return jsonb_build_object(
      'success', true,
      'issueId', backend_delete_issue_with_upload_targets.issue_id,
      'uploadTargets', '[]'::jsonb,
      'supporterUids', '[]'::jsonb
    );
  end if;

  if not backend_delete_issue_with_upload_targets.actor_can_manage
    and not (
      backend_delete_issue_with_upload_targets.author_delete_enabled
      and issue_record.author_uid = backend_delete_issue_with_upload_targets.actor_uid
    )
  then
    raise exception 'permission-denied';
  end if;

  select jsonb_build_array(jsonb_build_object('id', issue_record.id, 'type', 'issue'))
    || coalesce(jsonb_agg(jsonb_build_object('id', comment.id, 'type', 'comment')), '[]'::jsonb)
  into upload_targets
  from app_private.comments comment
  where comment.issue_id = issue_record.id;

  select coalesce(jsonb_agg(supporter.uid order by supporter.created_at), '[]'::jsonb)
  into supporter_uids
  from app_private.supports supporter
  where supporter.issue_id = issue_record.id;

  delete from app_private.issues where id = issue_record.id;

  return jsonb_build_object(
    'success', true,
    'issueId', issue_record.id,
    'authorUid', issue_record.author_uid,
    'issueCategory', issue_record.category,
    'readAccess', issue_record.read_access,
    'status', issue_record.status,
    'supporterUids', supporter_uids,
    'title', issue_record.title,
    'uploadTargets', upload_targets
  );
end;
$function$;

REVOKE ALL ON FUNCTION app_api.backend_delete_facility(uuid, text, boolean, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_api.backend_delete_issue_with_upload_targets(uuid, text, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_api.backend_delete_facility(uuid, text, boolean, boolean) TO novae_runtime;
GRANT EXECUTE ON FUNCTION app_api.backend_delete_issue_with_upload_targets(uuid, text, boolean, boolean) TO novae_runtime;
