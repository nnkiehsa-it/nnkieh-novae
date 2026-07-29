-- Make the settings page's complete category draft authoritative. New,
-- edited, and removed categories plus feature switches now commit together.

drop function app_api.backend_save_category_management(text,jsonb,jsonb,boolean,boolean);

create function app_api.backend_save_category_management(
  actor_uid text,
  issue_categories jsonb,
  facility_categories jsonb,
  deleted_issue_category_ids text[],
  deleted_facility_category_ids text[],
  issues_enabled boolean,
  facilities_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = app_private, app_api, public
as $$
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
      support_deadline_days,response_deadline_days,comments_enabled,is_active,
      is_default,sort_order,created_by,updated_at
    ) values(
      category->>'id',btrim(category->>'label'),category->>'readAccess',
      (category->>'authorVisible')::boolean,(category->>'supportEnabled')::boolean,
      nullif(category->>'supportGoal','')::integer,
      nullif(category->>'supportDeadlineDays','')::integer,
      nullif(category->>'responseDeadlineDays','')::integer,
      (category->>'commentsEnabled')::boolean,true,
      (category->>'isDefault')::boolean,(category->>'sortOrder')::integer,
      coalesce(existing_issue.created_by,actor_uid),now()
    ) on conflict(id) do update set
      label=excluded.label,support_enabled=excluded.support_enabled,
      support_goal=excluded.support_goal,support_deadline_days=excluded.support_deadline_days,
      response_deadline_days=excluded.response_deadline_days,
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
$$;

revoke all on function app_api.backend_save_category_management(
  text,jsonb,jsonb,text[],text[],boolean,boolean
) from public,anon,authenticated;
grant execute on function app_api.backend_save_category_management(
  text,jsonb,jsonb,text[],text[],boolean,boolean
) to service_role;
