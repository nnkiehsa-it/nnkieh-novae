-- Remove response deadlines end-to-end. Support deadlines and all access rules remain unchanged.
-- Replace only the affected function bodies; existing migrations remain immutable.

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
      support_deadline_days,comments_enabled,is_active,is_default,
      sort_order,created_by
    )
    select
      value->>'id', btrim(value->>'label'),
      value->>'readAccess', coalesce((value->>'authorVisible')::boolean,false),
      coalesce((value->>'supportEnabled')::boolean,false),
      nullif(value->>'supportGoal','')::integer,
      nullif(value->>'supportDeadlineDays','')::integer,
      coalesce((value->>'commentsEnabled')::boolean,true), true, ordinal = 1,
      ordinal - 1, backend_complete_initial_setup.actor_uid
    from jsonb_array_elements(issue_categories) with ordinality as items(value, ordinal)
    on conflict (id) do update set
      label=excluded.label,
      support_enabled=excluded.support_enabled,support_goal=excluded.support_goal,
      support_deadline_days=excluded.support_deadline_days,
      comments_enabled=excluded.comments_enabled,is_active=true,
      is_default=excluded.is_default,sort_order=excluded.sort_order;
  end if;

  if facilities_enabled then
    insert into app_private.facility_categories(
      id,label,is_active,is_default,sort_order,created_by
    )
    select value->>'id', btrim(value->>'label'),
      true, ordinal = 1, ordinal - 1, backend_complete_initial_setup.actor_uid
    from jsonb_array_elements(facility_categories) with ordinality as items(value, ordinal)
    on conflict (id) do update set
      label=excluded.label,is_active=true,
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

DROP FUNCTION app_api.backend_create_issue(actor_uid text, issue_title text, issue_content text, issue_category text, issue_status text, support_enabled boolean, support_goal integer, support_deadline_at timestamp with time zone, response_deadline_at timestamp with time zone, author_is_private boolean, actor_is_admin boolean, private_to_owner_categories text[], review_required_categories text[], author_private_categories text[]);

CREATE OR REPLACE FUNCTION app_api.backend_create_issue(actor_uid text, issue_title text, issue_content text, issue_category text, issue_status text, support_enabled boolean, support_goal integer, support_deadline_at timestamp with time zone, author_is_private boolean, actor_is_admin boolean, private_to_owner_categories text[], review_required_categories text[], author_private_categories text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app_private', 'app_api', 'public'
AS $function$
declare issue_record app_private.issues%rowtype;
begin
  insert into app_private.issues(
    author_uid,category,content,review_approved_at,status,
    support_count,support_deadline_at,support_enabled,support_goal,title,title_search
  ) values(
    actor_uid,issue_category,issue_content,null,issue_status,
    case when support_enabled then 1 else 0 end,support_deadline_at,
    support_enabled,support_goal,issue_title,lower(issue_title)
  ) returning * into issue_record;
  return app_api.backend_issue_to_json(issue_record,actor_uid,actor_is_admin,
    private_to_owner_categories,review_required_categories,author_private_categories);
end;
$function$;

REVOKE ALL ON FUNCTION app_api.backend_create_issue(actor_uid text, issue_title text, issue_content text, issue_category text, issue_status text, support_enabled boolean, support_goal integer, support_deadline_at timestamp with time zone, author_is_private boolean, actor_is_admin boolean, private_to_owner_categories text[], review_required_categories text[], author_private_categories text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_api.backend_create_issue(actor_uid text, issue_title text, issue_content text, issue_category text, issue_status text, support_enabled boolean, support_goal integer, support_deadline_at timestamp with time zone, author_is_private boolean, actor_is_admin boolean, private_to_owner_categories text[], review_required_categories text[], author_private_categories text[]) TO novae_runtime;

CREATE OR REPLACE FUNCTION app_api.backend_get_session_bootstrap_snapshot(actor_uid text, actor_is_admin boolean, actor_email text, actor_name text, actor_photo_url text, record_visit boolean)
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

CREATE OR REPLACE FUNCTION app_api.backend_issue_list_to_json(issue_record app_private.issues, actor_uid text, actor_is_admin boolean, current_user_supported boolean, private_to_owner_categories text[], review_required_categories text[], author_private_categories text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'app_private', 'app_api', 'public'
AS $function$
declare
  is_own_issue boolean := issue_record.author_uid = actor_uid;
  can_manage_issue boolean := actor_is_admin or is_own_issue;
  can_view_author boolean := actor_is_admin or is_own_issue or issue_record.author_visible;
begin
  if not actor_is_admin and not is_own_issue and issue_record.read_access = 'owner-admin' then raise exception 'not-found'; end if;
  if not actor_is_admin and not is_own_issue and issue_record.read_access = 'reviewed-school'
    and issue_record.status in ('under-review','review-rejected') then raise exception 'not-found'; end if;
  return jsonb_build_object(
    'id',issue_record.id,'title',issue_record.title,'created_at',issue_record.created_at,'closed_at',issue_record.closed_at,
    'created_at_ms',floor(extract(epoch from issue_record.created_at)*1000),
    'closed_at_ms',case when issue_record.closed_at is null then null else floor(extract(epoch from issue_record.closed_at)*1000) end,
    'support_count',issue_record.support_count,'status',issue_record.status,'category',issue_record.category,
    'comments_enabled',issue_record.comments_enabled,'read_access',issue_record.read_access,
    'support_enabled',issue_record.support_enabled,'support_goal',issue_record.support_goal,
    'support_deadline_at',issue_record.support_deadline_at,
    'support_deadline_at_ms',case when issue_record.support_deadline_at is null then null else floor(extract(epoch from issue_record.support_deadline_at)*1000) end,
    'review_approved_at',issue_record.review_approved_at,
    'review_approved_at_ms',case when issue_record.review_approved_at is null then null else floor(extract(epoch from issue_record.review_approved_at)*1000) end,
    'result_content',issue_record.result_content,'support_met_at',issue_record.support_met_at,
    'support_met_at_ms',case when issue_record.support_met_at is null then null else floor(extract(epoch from issue_record.support_met_at)*1000) end,
    'review_rejection_reason',issue_record.review_rejection_reason,
    'currentUserSupported',current_user_supported,'isOwnIssue',is_own_issue,
    'canManageIssue',can_manage_issue,'canViewAuthor',can_view_author,
    'author_uid',case when can_view_author then issue_record.author_uid else null end
  );
end;
$function$;

CREATE OR REPLACE FUNCTION app_api.backend_issue_to_json(issue_record app_private.issues, actor_uid text, actor_is_admin boolean, private_to_owner_categories text[], review_required_categories text[], author_private_categories text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'app_private', 'app_api', 'public'
AS $function$
declare
  is_own_issue boolean := issue_record.author_uid = actor_uid;
  can_manage_issue boolean := actor_is_admin or is_own_issue;
  can_view_author boolean := actor_is_admin or is_own_issue or issue_record.author_visible;
  current_user_supported boolean;
begin
  if not actor_is_admin and not is_own_issue and issue_record.read_access = 'owner-admin' then
    raise exception 'not-found';
  end if;
  if not actor_is_admin and not is_own_issue and issue_record.read_access = 'reviewed-school'
    and issue_record.status in ('under-review', 'review-rejected') then
    raise exception 'not-found';
  end if;
  select exists(
    select 1 from app_private.supports support
    where support.issue_id = issue_record.id and support.uid = actor_uid
  ) into current_user_supported;

  return jsonb_build_object(
    'id', issue_record.id,
    'title', issue_record.title,
    'content', issue_record.content,
    'category', issue_record.category,
    'status', issue_record.status,
    'revision', issue_record.revision,
    'commentsEnabled', issue_record.comments_enabled,
    'readAccess', issue_record.read_access,
    'supportEnabled', issue_record.support_enabled,
    'supportGoal', issue_record.support_goal,
    'supportCount', issue_record.support_count,
    'supportDeadlineAt', issue_record.support_deadline_at,
    'reviewApprovedAt', issue_record.review_approved_at,
    'reviewRejectionReason', issue_record.review_rejection_reason,
    'resultContent', issue_record.result_content,
    'supportMetAt', issue_record.support_met_at,
    'closedAt', issue_record.closed_at,
    'createdAt', issue_record.created_at,
    'currentUserSupported', current_user_supported,
    'isOwnIssue', is_own_issue,
    'canManageIssue', can_manage_issue,
    'canViewAuthor', can_view_author,
    'authorUid', case when can_view_author then issue_record.author_uid else null end
  );
end;
$function$;

DROP FUNCTION app_api.backend_moderate_issue_status(issue_id uuid, actor_uid text, actor_is_admin boolean, next_status text, review_rejection_reason text, support_deadline_at timestamp with time zone, response_deadline_at timestamp with time zone, review_approved_at timestamp with time zone, private_to_owner_categories text[], review_required_categories text[], author_private_categories text[]);

CREATE OR REPLACE FUNCTION app_api.backend_moderate_issue_status(issue_id uuid, actor_uid text, actor_is_admin boolean, next_status text, review_rejection_reason text, support_deadline_at timestamp with time zone, review_approved_at timestamp with time zone, private_to_owner_categories text[], review_required_categories text[], author_private_categories text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app_private', 'app_api', 'public'
AS $function$
declare
  issue_record app_private.issues%rowtype;
begin
  if not actor_is_admin then raise exception 'permission-denied'; end if;
  select * into issue_record from app_private.issues where id = issue_id for update;
  if not found then raise exception 'not-found'; end if;

  update app_private.issues
  set status = next_status,
      review_rejection_reason = case when next_status = 'review-rejected' then backend_moderate_issue_status.review_rejection_reason else null end,
      support_deadline_at = coalesce(backend_moderate_issue_status.support_deadline_at, issues.support_deadline_at),
      review_approved_at = coalesce(backend_moderate_issue_status.review_approved_at, issues.review_approved_at),
      closed_at = case when next_status in ('auto-rejected', 'review-rejected', 'infeasible', 'completed') then now() else null end
  where id = issue_id
  returning * into issue_record;

  return app_api.backend_issue_to_json(
    issue_record, actor_uid, actor_is_admin,
    private_to_owner_categories, review_required_categories, author_private_categories
  );
end;
$function$;

REVOKE ALL ON FUNCTION app_api.backend_moderate_issue_status(issue_id uuid, actor_uid text, actor_is_admin boolean, next_status text, review_rejection_reason text, support_deadline_at timestamp with time zone, review_approved_at timestamp with time zone, private_to_owner_categories text[], review_required_categories text[], author_private_categories text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_api.backend_moderate_issue_status(issue_id uuid, actor_uid text, actor_is_admin boolean, next_status text, review_rejection_reason text, support_deadline_at timestamp with time zone, review_approved_at timestamp with time zone, private_to_owner_categories text[], review_required_categories text[], author_private_categories text[]) TO novae_runtime;

CREATE OR REPLACE FUNCTION app_api.backend_save_category_management(actor_uid text, issue_categories jsonb, facility_categories jsonb, deleted_issue_category_ids text[], deleted_facility_category_ids text[], issues_enabled boolean, facilities_enabled boolean)
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
      id,label,read_access,author_visible,support_enabled,support_goal,
      support_deadline_days,comments_enabled,is_active,
      is_default,sort_order,created_by,updated_at
    ) values(
      category->>'id',btrim(category->>'label'),category->>'readAccess',
      (category->>'authorVisible')::boolean,(category->>'supportEnabled')::boolean,
      nullif(category->>'supportGoal','')::integer,
      nullif(category->>'supportDeadlineDays','')::integer,
      (category->>'commentsEnabled')::boolean,true,
      (category->>'isDefault')::boolean,(category->>'sortOrder')::integer,
      coalesce(existing_issue.created_by,actor_uid),now()
    ) on conflict(id) do update set
      label=excluded.label,support_enabled=excluded.support_enabled,
      support_goal=excluded.support_goal,support_deadline_days=excluded.support_deadline_days,
      comments_enabled=excluded.comments_enabled,is_active=true,
      is_default=excluded.is_default,sort_order=excluded.sort_order,updated_at=now()
    returning to_jsonb(saved) into saved_value;

    insert into app_private.category_configuration_audit(
      actor_uid,category_id,domain,operation,before_value,after_value
    ) values(
      actor_uid,category->>'id','issue',case when before_value is null then 'create' else 'update' end,
      before_value,saved_value
    );
  end loop;

  update app_private.facility_categories set is_default = false where is_default;
  for category in select value from jsonb_array_elements(facility_categories)
  loop
    select * into existing_facility from app_private.facility_categories where id = category->>'id';
    before_value := case when found then to_jsonb(existing_facility) else null end;

    insert into app_private.facility_categories as saved(
      id,label,is_active,is_default,sort_order,created_by,updated_at
    ) values(
      category->>'id',btrim(category->>'label'),true,
      (category->>'isDefault')::boolean,(category->>'sortOrder')::integer,
      coalesce(existing_facility.created_by,actor_uid),now()
    ) on conflict(id) do update set
      label=excluded.label,is_active=true,is_default=excluded.is_default,
      sort_order=excluded.sort_order,updated_at=now()
    returning to_jsonb(saved) into saved_value;

    insert into app_private.category_configuration_audit(
      actor_uid,category_id,domain,operation,before_value,after_value
    ) values(
      actor_uid,category->>'id','facility',case when before_value is null then 'create' else 'update' end,
      before_value,saved_value
    );
  end loop;

  perform app_api.backend_update_platform_features(
    actor_uid,issues_enabled,facilities_enabled
  );
  return jsonb_build_object('success',true);
end;
$function$;

DROP FUNCTION app_api.backend_toggle_support(issue_id uuid, actor_uid text, remove_support boolean, response_deadline_days integer);

CREATE OR REPLACE FUNCTION app_api.backend_toggle_support(issue_id uuid, actor_uid text, remove_support boolean)
 RETURNS TABLE(supported boolean, support_count integer, goal_met boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app_private', 'app_api', 'public'
AS $function$
declare
  issue_record app_private.issues%rowtype;
  already_supported boolean;
  next_support_count integer;
  became_goal_met boolean := false;
begin
  select * into issue_record from app_private.issues where id = issue_id for update;
  if not found then raise exception 'not-found'; end if;
  if not issue_record.support_enabled then raise exception 'support-disabled'; end if;

  select exists(
    select 1 from app_private.supports where supports.issue_id = backend_toggle_support.issue_id and supports.uid = actor_uid
  ) into already_supported;

  if remove_support then
    if already_supported then
      delete from app_private.supports where supports.issue_id = backend_toggle_support.issue_id and supports.uid = actor_uid;
    end if;
  else
    if not already_supported then
      insert into app_private.supports(issue_id, uid) values (issue_id, actor_uid);
    end if;
  end if;

  select issues.support_count into next_support_count
  from app_private.issues where issues.id = backend_toggle_support.issue_id;

  if not remove_support and issue_record.support_goal is not null and next_support_count >= issue_record.support_goal and issue_record.support_met_at is null then
    became_goal_met := true;
    update app_private.issues
    set support_met_at = now(),
        status = case when status = 'pending' then 'processing' else status end
    where id = issue_id;
  end if;

  return query select not remove_support, next_support_count, became_goal_met;
end;
$function$;

REVOKE ALL ON FUNCTION app_api.backend_toggle_support(issue_id uuid, actor_uid text, remove_support boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_api.backend_toggle_support(issue_id uuid, actor_uid text, remove_support boolean) TO novae_runtime;

CREATE OR REPLACE FUNCTION app_private.prevent_issue_policy_snapshot_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'app_private', 'public'
AS $function$
begin
  if new.category is distinct from old.category
    or new.read_access is distinct from old.read_access
    or new.author_visible is distinct from old.author_visible
    or new.support_enabled is distinct from old.support_enabled
    or new.support_goal is distinct from old.support_goal
    or new.support_deadline_days is distinct from old.support_deadline_days then
    raise exception 'immutable-category-policy';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION app_private.snapshot_issue_category_defaults()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'app_private', 'public'
AS $function$
declare category_record app_private.issue_categories%rowtype;
begin
  select * into category_record from app_private.issue_categories
  where id = new.category and is_active;
  if not found then raise exception 'invalid-issue-category'; end if;
  new.comments_enabled := category_record.comments_enabled;
  new.read_access := category_record.read_access;
  new.author_visible := category_record.author_visible;
  new.support_deadline_days := category_record.support_deadline_days;
  return new;
end;
$function$;

ALTER TABLE app_private.issues DROP COLUMN response_deadline_at, DROP COLUMN response_deadline_days;
ALTER TABLE app_private.issue_categories DROP COLUMN response_deadline_days;
