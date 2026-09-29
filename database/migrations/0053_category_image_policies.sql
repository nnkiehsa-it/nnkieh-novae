-- Move image counts into content policies. Zero disables new images; existing media stays readable.
ALTER TABLE app_private.issue_categories
  ADD COLUMN max_images integer NOT NULL DEFAULT 2 CHECK (max_images BETWEEN 0 AND 20),
  ADD COLUMN comment_max_images integer NOT NULL DEFAULT 1 CHECK (comment_max_images BETWEEN 0 AND 20);
ALTER TABLE app_private.facility_categories
  ADD COLUMN max_images integer NOT NULL DEFAULT 2 CHECK (max_images BETWEEN 0 AND 20);
ALTER TABLE app_private.system_setup
  ADD COLUMN announcement_max_images integer NOT NULL DEFAULT 10 CHECK (announcement_max_images BETWEEN 0 AND 20),
  ADD COLUMN announcement_comment_max_images integer NOT NULL DEFAULT 1 CHECK (announcement_comment_max_images BETWEEN 0 AND 20);

UPDATE app_private.issue_categories SET
  max_images = (SELECT (value::jsonb->>'issueMaxImages')::integer FROM app_private.runtime_settings WHERE key='image_upload_settings'),
  comment_max_images = (SELECT (value::jsonb->>'commentMaxImages')::integer FROM app_private.runtime_settings WHERE key='image_upload_settings');
UPDATE app_private.facility_categories SET
  max_images = (SELECT (value::jsonb->>'facilityMaxImages')::integer FROM app_private.runtime_settings WHERE key='image_upload_settings');
UPDATE app_private.system_setup SET
  announcement_max_images = (SELECT (value::jsonb->>'announcementMaxImages')::integer FROM app_private.runtime_settings WHERE key='image_upload_settings'),
  announcement_comment_max_images = (SELECT (value::jsonb->>'commentMaxImages')::integer FROM app_private.runtime_settings WHERE key='image_upload_settings');
UPDATE app_private.runtime_settings
SET value = (value::jsonb - 'issueMaxImages' - 'facilityMaxImages' - 'announcementMaxImages' - 'commentMaxImages')::text
WHERE key='image_upload_settings';

CREATE FUNCTION app_api.backend_save_announcement_image_policy(actor_uid text, max_images integer, comment_max_images integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'app_private', 'app_api', 'public'
AS $$
DECLARE before_value jsonb; after_value jsonb;
BEGIN
  SELECT jsonb_build_object('maxImages', announcement_max_images, 'commentMaxImages', announcement_comment_max_images)
  INTO before_value FROM app_private.system_setup WHERE singleton FOR UPDATE;
  after_value := jsonb_build_object('maxImages', max_images, 'commentMaxImages', comment_max_images);
  IF before_value = after_value THEN RETURN; END IF;
  UPDATE app_private.system_setup SET announcement_max_images=max_images,
    announcement_comment_max_images=comment_max_images, updated_at=now() WHERE singleton;
  INSERT INTO app_private.category_configuration_audit(actor_uid,domain,operation,before_value,after_value)
  VALUES(actor_uid,'setup','update-features',before_value,after_value);
END;
$$;
REVOKE ALL ON FUNCTION app_api.backend_save_announcement_image_policy(text,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_api.backend_save_announcement_image_policy(text,integer,integer) TO novae_runtime;

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
    'maxImages', category.max_images,
    'authorVisible', category.author_visible,
    'commentsEnabled', category.comments_enabled,
    'commentMaxImages', category.comment_max_images,
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
    'maxImages', category.max_images,
    'id', category.id,
    'isDefault', category.is_default,
    'label', category.label,
    'sortOrder', category.sort_order
  ) order by category.sort_order, category.created_at, category.id), '[]'::jsonb)
  into facility_categories
  from app_private.facility_categories category;

  select coalesce(jsonb_build_object(
    'announcementCommentsEnabled', setup.announcement_comments_enabled,
    'announcementMaxImages', setup.announcement_max_images,
    'announcementCommentMaxImages', setup.announcement_comment_max_images,
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
      max_images,comment_max_images,support_enabled,support_goal,support_deadline_days,comments_enabled,
      is_active,is_default,sort_order,created_by,updated_at
    ) values(
      category->>'id',btrim(category->>'label'),category->>'readAccess',
      (category->>'authorVisible')::boolean,
      coalesce((category->>'authorDeleteEnabled')::boolean,false),
      (category->>'maxImages')::integer,(category->>'commentMaxImages')::integer,
      (category->>'supportEnabled')::boolean,
      nullif(category->>'supportGoal','')::integer,
      nullif(category->>'supportDeadlineDays','')::integer,
      (category->>'commentsEnabled')::boolean,true,
      (category->>'isDefault')::boolean,(category->>'sortOrder')::integer,
      coalesce(existing_issue.created_by,actor_uid),now()
    ) on conflict(id) do update set
      label=excluded.label,
      author_delete_enabled=excluded.author_delete_enabled,
      max_images=excluded.max_images,comment_max_images=excluded.comment_max_images,
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
      id,label,author_delete_enabled,max_images,is_active,is_default,sort_order,created_by,updated_at
    ) values(
      category->>'id',btrim(category->>'label'),
      coalesce((category->>'authorDeleteEnabled')::boolean,false),(category->>'maxImages')::integer,true,
      (category->>'isDefault')::boolean,(category->>'sortOrder')::integer,
      coalesce(existing_facility.created_by,actor_uid),now()
    ) on conflict(id) do update set
      label=excluded.label,
      author_delete_enabled=excluded.author_delete_enabled,
      max_images=excluded.max_images,
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

CREATE OR REPLACE FUNCTION app_api.backend_complete_initial_setup(actor_uid text, issue_categories jsonb, facility_categories jsonb, issues_enabled boolean, facilities_enabled boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app_private', 'app_api', 'public'
AS $function$
declare setup_record app_private.system_setup%rowtype;
begin
  select * into setup_record from app_private.system_setup where singleton for update;
  if setup_record.completed_at is not null then raise exception 'setup-already-completed'; end if;
  if jsonb_typeof(issue_categories) <> 'array' or jsonb_typeof(facility_categories) <> 'array'
    or (issues_enabled and jsonb_array_length(issue_categories) = 0)
    or (facilities_enabled and jsonb_array_length(facility_categories) = 0) then
    raise exception 'validation-required';
  end if;

  delete from app_private.issue_categories existing where existing.created_by = 'migration'
    and not exists(select 1 from app_private.issues legacy_issue where legacy_issue.category = existing.id)
    and not exists(select 1 from app_private.user_issue_category_assignments assignment where assignment.category_id = existing.id);
  delete from app_private.facility_categories existing where existing.created_by = 'migration'
    and not exists(select 1 from app_private.facility_reports legacy_facility where legacy_facility.category_id = existing.id)
    and not exists(select 1 from app_private.user_facility_category_assignments assignment where assignment.category_id = existing.id);

  if issues_enabled then
    insert into app_private.issue_categories(
      id,label,read_access,author_visible,support_enabled,support_goal,
      support_deadline_days,comments_enabled,max_images,comment_max_images,is_active,is_default,
      sort_order,created_by
    )
    select
      value->>'id', btrim(value->>'label'),
      value->>'readAccess', coalesce((value->>'authorVisible')::boolean,false),
      coalesce((value->>'supportEnabled')::boolean,false),
      nullif(value->>'supportGoal','')::integer,
      nullif(value->>'supportDeadlineDays','')::integer,
      coalesce((value->>'commentsEnabled')::boolean,true),
      (value->>'maxImages')::integer,(value->>'commentMaxImages')::integer, true, ordinal = 1,
      ordinal - 1, backend_complete_initial_setup.actor_uid
    from jsonb_array_elements(issue_categories) with ordinality as items(value, ordinal)
    on conflict (id) do update set
      label=excluded.label,
      support_enabled=excluded.support_enabled,support_goal=excluded.support_goal,
      support_deadline_days=excluded.support_deadline_days,
      max_images=excluded.max_images,comment_max_images=excluded.comment_max_images,
      comments_enabled=excluded.comments_enabled,is_active=true,
      is_default=excluded.is_default,sort_order=excluded.sort_order;
  end if;

  if facilities_enabled then
    insert into app_private.facility_categories(
      id,label,max_images,is_active,is_default,sort_order,created_by
    )
    select value->>'id', btrim(value->>'label'), (value->>'maxImages')::integer,
      true, ordinal = 1, ordinal - 1, backend_complete_initial_setup.actor_uid
    from jsonb_array_elements(facility_categories) with ordinality as items(value, ordinal)
    on conflict (id) do update set
      label=excluded.label,max_images=excluded.max_images,is_active=true,
      is_default=excluded.is_default,sort_order=excluded.sort_order;
  end if;

  update app_private.system_setup set
    completed_at=now(),completed_by=actor_uid,
    issues_enabled=backend_complete_initial_setup.issues_enabled,
    facilities_enabled=backend_complete_initial_setup.facilities_enabled,
    updated_at=now()
  where singleton;
  insert into app_private.category_configuration_audit(domain,operation,actor_uid,after_value)
  values('setup','complete-setup',actor_uid,jsonb_build_object(
    'issuesEnabled',issues_enabled,
    'facilitiesEnabled',facilities_enabled,
    'issueCategoryCount',case when issues_enabled then jsonb_array_length(issue_categories) else 0 end,
    'facilityCategoryCount',case when facilities_enabled then jsonb_array_length(facility_categories) else 0 end
  ));
  return jsonb_build_object(
    'success',true,'setupCompleted',true,
    'issuesEnabled',issues_enabled,'facilitiesEnabled',facilities_enabled
  );
end;
$function$;
