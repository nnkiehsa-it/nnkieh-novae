-- Update one access scope at a time so concurrent administrators cannot
-- overwrite unrelated assignments. Existing facility notification opt-outs
-- remain attached to unchanged assignments.

create or replace function app_api.backend_update_user_access_scope(
  actor_uid text,
  target_uid text,
  scope_kind text,
  category_id text,
  grant_access boolean
)
returns jsonb
language plpgsql
security definer
set search_path = app_private, app_api, public
as $$
declare
  previous_roles text[];
  previous_issue_ids text[];
  previous_facility_ids text[];
  next_roles text[];
  next_issue_ids text[];
  next_facility_ids text[];
  before_value jsonb;
  after_value jsonb;
  changed boolean := false;
  changed_count integer := 0;
begin
  if coalesce(btrim(actor_uid), '') = '' or coalesce(btrim(target_uid), '') = ''
    or scope_kind not in ('announcement', 'issue', 'facility') or grant_access is null then
    raise exception 'validation-required';
  end if;
  if scope_kind in ('issue', 'facility') and coalesce(btrim(category_id), '') = '' then
    raise exception 'validation-required';
  end if;
  if scope_kind = 'announcement' and coalesce(btrim(category_id), '') <> '' then
    raise exception 'validation-invalid';
  end if;

  perform 1 from app_private.user_profiles profile
  where profile.uid = backend_update_user_access_scope.target_uid
  for update;
  if not found then raise exception 'not-found'; end if;

  select coalesce(array_agg(assignment.role_code order by assignment.role_code), array[]::text[])
    into previous_roles from app_private.user_role_assignments assignment
    where assignment.uid = backend_update_user_access_scope.target_uid;
  select coalesce(array_agg(assignment.category_id order by assignment.category_id), array[]::text[])
    into previous_issue_ids from app_private.user_issue_category_assignments assignment
    where assignment.uid = backend_update_user_access_scope.target_uid;
  select coalesce(array_agg(assignment.category_id order by assignment.category_id), array[]::text[])
    into previous_facility_ids from app_private.user_facility_category_assignments assignment
    where assignment.uid = backend_update_user_access_scope.target_uid;

  if 'platform-admin' = any(previous_roles) then raise exception 'permission-denied'; end if;

  before_value := jsonb_build_object(
    'roles', to_jsonb(previous_roles),
    'managedIssueCategoryIds', to_jsonb(previous_issue_ids),
    'managedFacilityCategoryIds', to_jsonb(previous_facility_ids)
  );

  if scope_kind = 'announcement' then
    if grant_access then
      insert into app_private.user_role_assignments(uid, role_code, granted_by)
      values(backend_update_user_access_scope.target_uid, 'announcement-manager', backend_update_user_access_scope.actor_uid)
      on conflict (uid, role_code) do nothing;
    else
      delete from app_private.user_role_assignments
      where user_role_assignments.uid = backend_update_user_access_scope.target_uid
        and user_role_assignments.role_code = 'announcement-manager';
    end if;
    get diagnostics changed_count = row_count;
    changed := changed_count > 0;
    if changed then
      insert into app_private.role_assignment_audit(uid, role_code, operation, actor_uid)
      values(
        backend_update_user_access_scope.target_uid,
        'announcement-manager',
        case when grant_access then 'grant' else 'revoke' end,
        backend_update_user_access_scope.actor_uid
      );
    end if;
  elsif scope_kind = 'issue' then
    if not exists(select 1 from app_private.issue_categories category
      where category.id = backend_update_user_access_scope.category_id and category.is_active) then
      raise exception 'validation-invalid';
    end if;
    if grant_access then
      insert into app_private.user_issue_category_assignments(uid, category_id, granted_by)
      values(
        backend_update_user_access_scope.target_uid,
        backend_update_user_access_scope.category_id,
        backend_update_user_access_scope.actor_uid
      )
      on conflict on constraint user_issue_category_assignments_pkey do nothing;
    else
      delete from app_private.user_issue_category_assignments
      where user_issue_category_assignments.uid = backend_update_user_access_scope.target_uid
        and user_issue_category_assignments.category_id = backend_update_user_access_scope.category_id;
    end if;
    get diagnostics changed_count = row_count;
    changed := changed_count > 0;
  else
    if not exists(select 1 from app_private.facility_categories category
      where category.id = backend_update_user_access_scope.category_id and category.is_active) then
      raise exception 'validation-invalid';
    end if;
    if grant_access then
      insert into app_private.user_facility_category_assignments(uid, category_id, notify_on_created, granted_by)
      values(
        backend_update_user_access_scope.target_uid,
        backend_update_user_access_scope.category_id,
        true,
        backend_update_user_access_scope.actor_uid
      )
      on conflict on constraint user_facility_category_assignments_pkey do nothing;
    else
      delete from app_private.user_facility_category_assignments
      where user_facility_category_assignments.uid = backend_update_user_access_scope.target_uid
        and user_facility_category_assignments.category_id = backend_update_user_access_scope.category_id;
    end if;
    get diagnostics changed_count = row_count;
    changed := changed_count > 0;
  end if;

  select coalesce(array_agg(assignment.role_code order by assignment.role_code), array[]::text[])
    into next_roles from app_private.user_role_assignments assignment
    where assignment.uid = backend_update_user_access_scope.target_uid;
  select coalesce(array_agg(assignment.category_id order by assignment.category_id), array[]::text[])
    into next_issue_ids from app_private.user_issue_category_assignments assignment
    where assignment.uid = backend_update_user_access_scope.target_uid;
  select coalesce(array_agg(assignment.category_id order by assignment.category_id), array[]::text[])
    into next_facility_ids from app_private.user_facility_category_assignments assignment
    where assignment.uid = backend_update_user_access_scope.target_uid;

  after_value := jsonb_build_object(
    'roles', to_jsonb(next_roles),
    'managedIssueCategoryIds', to_jsonb(next_issue_ids),
    'managedFacilityCategoryIds', to_jsonb(next_facility_ids)
  );
  if changed then
    insert into app_private.access_assignment_audit(actor_uid, target_uid, before_value, after_value)
    values(
      backend_update_user_access_scope.actor_uid,
      backend_update_user_access_scope.target_uid,
      before_value,
      after_value
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'roles', to_jsonb(next_roles),
    'managedIssueCategoryIds', to_jsonb(next_issue_ids),
    'managedFacilityCategoryIds', to_jsonb(next_facility_ids)
  );
end;
$$;

revoke all on function app_api.backend_update_user_access_scope(text,text,text,text,boolean) from public, anon, authenticated;
grant execute on function app_api.backend_update_user_access_scope(text,text,text,text,boolean) to service_role;

drop function app_api.backend_set_user_access(text,text,text[],text[],text[]);
