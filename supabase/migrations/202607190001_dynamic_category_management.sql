-- Runtime-managed proposal and facility categories. Privacy and author rules are
-- immutable after creation; support, response, and comment defaults are snapshotted
-- onto each new proposal so later configuration changes never rewrite history.

create table app_private.issue_categories (
  id text primary key check (id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  label text not null check (length(btrim(label)) between 1 and 40),
  description text not null default '' check (length(description) <= 240),
  read_access text not null check (read_access in ('school', 'reviewed-school', 'owner-admin')),
  author_visible boolean not null,
  support_enabled boolean not null default false,
  support_goal integer check (support_goal is null or support_goal > 0),
  support_deadline_days integer check (support_deadline_days is null or support_deadline_days > 0),
  response_deadline_days integer check (response_deadline_days is null or response_deadline_days > 0),
  comments_enabled boolean not null default true,
  is_active boolean not null default true,
  is_default boolean not null default false,
  sort_order integer not null default 0,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (support_enabled and support_goal is not null and support_deadline_days is not null)
    or (not support_enabled and support_goal is null and support_deadline_days is null)
  ),
  check (read_access <> 'owner-admin' or author_visible)
);

create unique index issue_categories_single_default_idx
  on app_private.issue_categories(is_default) where is_default;
create index issue_categories_active_order_idx
  on app_private.issue_categories(is_active, sort_order, created_at, id);

create table app_private.facility_categories (
  id text primary key check (id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  label text not null check (length(btrim(label)) between 1 and 40),
  description text not null default '' check (length(description) <= 240),
  is_active boolean not null default true,
  is_default boolean not null default false,
  sort_order integer not null default 0,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index facility_categories_single_default_idx
  on app_private.facility_categories(is_default) where is_default;
create index facility_categories_active_order_idx
  on app_private.facility_categories(is_active, sort_order, created_at, id);

create table app_private.user_facility_category_assignments (
  uid text not null,
  category_id text not null references app_private.facility_categories(id) on delete cascade,
  notify_on_created boolean not null default true,
  granted_by text not null,
  granted_at timestamptz not null default now(),
  primary key (uid, category_id)
);

create index user_facility_category_assignments_category_uid_idx
  on app_private.user_facility_category_assignments(category_id, uid);

create table app_private.category_configuration_audit (
  id bigint generated always as identity primary key,
  domain text not null check (domain in ('issue', 'facility', 'setup')),
  category_id text,
  operation text not null check (operation in ('create', 'update', 'archive', 'restore', 'complete-setup')),
  actor_uid text not null,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz not null default now()
);

create index category_configuration_audit_created_idx
  on app_private.category_configuration_audit(created_at desc, id desc);

create table app_private.system_setup (
  singleton boolean primary key default true check (singleton),
  completed_at timestamptz,
  completed_by text,
  updated_at timestamptz not null default now()
);

insert into app_private.permissions(code,label) values
  ('category.manage','管理分類設定')
on conflict (code) do update set label=excluded.label;
insert into app_private.role_permissions(role_code,permission_code) values
  ('platform-admin','category.manage')
on conflict do nothing;

-- Convert the currently shipped categories into editable runtime data. Unknown
-- legacy category IDs are retained with the safest visibility so migrations never
-- strand or expose existing records.
insert into app_private.issue_categories(
  id,label,description,read_access,author_visible,support_enabled,support_goal,
  support_deadline_days,response_deadline_days,comments_enabled,is_active,is_default,
  sort_order,created_by
) values
  ('public-issues','公共議題','','reviewed-school',false,true,50,14,7,true,true,true,0,'migration'),
  ('rights-maintenance','學生權益','','owner-admin',true,false,null,null,7,true,true,false,1,'migration')
on conflict (id) do nothing;

insert into app_private.issue_categories(
  id,label,description,read_access,author_visible,support_enabled,support_goal,
  support_deadline_days,response_deadline_days,comments_enabled,is_active,is_default,
  sort_order,created_by
)
select legacy.id, legacy.id, '', 'owner-admin', true, false, null, null, null,
  true, false, false, (1000 + row_number() over(order by legacy.id))::integer, 'migration'
from (
  select distinct category as id from app_private.issues
  union
  select distinct category_id from app_private.user_issue_category_assignments
) legacy
where legacy.id is not null
  and legacy.id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
on conflict (id) do nothing;

insert into app_private.facility_categories(
  id,label,description,is_active,is_default,sort_order,created_by
) values ('general','一般設備','',true,true,0,'migration')
on conflict (id) do nothing;

alter table app_private.issues
  add column comments_enabled boolean not null default true,
  add column read_access text,
  add column author_visible boolean,
  add column support_deadline_days integer,
  add column response_deadline_days integer;

update app_private.issues issue
set read_access=category.read_access,author_visible=category.author_visible,
  support_deadline_days=category.support_deadline_days,
  response_deadline_days=category.response_deadline_days
from app_private.issue_categories category
where category.id=issue.category;
alter table app_private.issues alter column read_access set not null;
alter table app_private.issues alter column author_visible set not null;
alter table app_private.issues add constraint issues_read_access_check
  check (read_access in ('school','reviewed-school','owner-admin'));

alter table app_private.issues
  add constraint issues_category_runtime_fk foreign key (category)
  references app_private.issue_categories(id) on update cascade on delete restrict;

alter table app_private.user_issue_category_assignments
  add constraint user_issue_category_assignments_category_runtime_fk foreign key (category_id)
  references app_private.issue_categories(id) on update cascade on delete cascade;

alter table app_private.facility_reports add column category_id text;
update app_private.facility_reports set category_id = 'general' where category_id is null;
alter table app_private.facility_reports alter column category_id set not null;
alter table app_private.facility_reports
  add constraint facility_reports_category_runtime_fk foreign key (category_id)
  references app_private.facility_categories(id) on update cascade on delete restrict;
create index facility_reports_category_status_created_idx
  on app_private.facility_reports(category_id, status, created_at desc, id desc);

create or replace function app_private.snapshot_issue_category_defaults()
returns trigger language plpgsql set search_path = app_private, public as $$
declare category_record app_private.issue_categories%rowtype;
begin
  select * into category_record from app_private.issue_categories
  where id = new.category and is_active;
  if not found then raise exception 'invalid-issue-category'; end if;
  new.comments_enabled := category_record.comments_enabled;
  new.read_access := category_record.read_access;
  new.author_visible := category_record.author_visible;
  new.support_deadline_days := category_record.support_deadline_days;
  new.response_deadline_days := category_record.response_deadline_days;
  return new;
end;
$$;

create trigger snapshot_issue_category_defaults
before insert on app_private.issues
for each row execute function app_private.snapshot_issue_category_defaults();

create or replace function app_private.prevent_issue_policy_snapshot_change()
returns trigger language plpgsql set search_path = app_private, public as $$
begin
  if new.category is distinct from old.category
    or new.read_access is distinct from old.read_access
    or new.author_visible is distinct from old.author_visible
    or new.support_enabled is distinct from old.support_enabled
    or new.support_goal is distinct from old.support_goal
    or new.support_deadline_days is distinct from old.support_deadline_days
    or new.response_deadline_days is distinct from old.response_deadline_days then
    raise exception 'immutable-category-policy';
  end if;
  return new;
end;
$$;

create trigger prevent_issue_policy_snapshot_change
before update on app_private.issues
for each row execute function app_private.prevent_issue_policy_snapshot_change();

create or replace function app_private.prevent_comment_when_disabled()
returns trigger language plpgsql set search_path = app_private, public as $$
begin
  perform 1 from app_private.issues issue
  where issue.id = new.issue_id and issue.comments_enabled
  for share;
  if not found then
    raise exception 'comments-disabled';
  end if;
  return new;
end;
$$;

create trigger prevent_comment_when_disabled
before insert on app_private.comments
for each row execute function app_private.prevent_comment_when_disabled();

-- Existing installations with content are already configured. Empty installations
-- enter the guided setup when an ADMIN_EMAILS account first signs in.
insert into app_private.system_setup(singleton, completed_at, completed_by)
select true,
  case when exists(select 1 from app_private.issues) or exists(select 1 from app_private.facility_reports)
    then now() else null end,
  case when exists(select 1 from app_private.issues) or exists(select 1 from app_private.facility_reports)
    then 'migration' else null end
on conflict (singleton) do nothing;

create or replace function app_private.prevent_issue_category_identity_change()
returns trigger language plpgsql set search_path = app_private, public as $$
begin
  if new.id is distinct from old.id
    or new.read_access is distinct from old.read_access
    or new.author_visible is distinct from old.author_visible then
    raise exception 'immutable-category-policy';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger prevent_issue_category_identity_change
before update on app_private.issue_categories
for each row execute function app_private.prevent_issue_category_identity_change();

create or replace function app_private.touch_facility_category()
returns trigger language plpgsql set search_path = app_private, public as $$
begin
  if new.id is distinct from old.id then raise exception 'immutable-category-policy'; end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger touch_facility_category
before update on app_private.facility_categories
for each row execute function app_private.touch_facility_category();

create or replace function app_api.backend_complete_initial_setup(
  actor_uid text,
  issue_categories jsonb,
  facility_categories jsonb
)
returns jsonb language plpgsql security definer
set search_path = app_private, app_api, public as $$
declare setup_record app_private.system_setup%rowtype;
begin
  select * into setup_record from app_private.system_setup where singleton for update;
  if setup_record.completed_at is not null then raise exception 'setup-already-completed'; end if;
  if jsonb_typeof(issue_categories) <> 'array' or jsonb_array_length(issue_categories) = 0
    or jsonb_typeof(facility_categories) <> 'array' or jsonb_array_length(facility_categories) = 0 then
    raise exception 'validation-required';
  end if;

  delete from app_private.issue_categories existing where existing.created_by = 'migration'
    and not exists(select 1 from app_private.issues legacy_issue where legacy_issue.category = existing.id)
    and not exists(select 1 from app_private.user_issue_category_assignments assignment where assignment.category_id = existing.id);
  delete from app_private.facility_categories existing where existing.created_by = 'migration'
    and not exists(select 1 from app_private.facility_reports legacy_facility where legacy_facility.category_id = existing.id)
    and not exists(select 1 from app_private.user_facility_category_assignments assignment where assignment.category_id = existing.id);

  insert into app_private.issue_categories(
    id,label,description,read_access,author_visible,support_enabled,support_goal,
    support_deadline_days,response_deadline_days,comments_enabled,is_active,is_default,
    sort_order,created_by
  )
  select
    value->>'id', btrim(value->>'label'), btrim(coalesce(value->>'description','')),
    value->>'readAccess', coalesce((value->>'authorVisible')::boolean,false),
    coalesce((value->>'supportEnabled')::boolean,false),
    nullif(value->>'supportGoal','')::integer,
    nullif(value->>'supportDeadlineDays','')::integer,
    nullif(value->>'responseDeadlineDays','')::integer,
    coalesce((value->>'commentsEnabled')::boolean,true), true, ordinal = 1,
    ordinal - 1, backend_complete_initial_setup.actor_uid
  from jsonb_array_elements(issue_categories) with ordinality as items(value, ordinal)
  on conflict (id) do update set
    label=excluded.label,description=excluded.description,
    support_enabled=excluded.support_enabled,support_goal=excluded.support_goal,
    support_deadline_days=excluded.support_deadline_days,
    response_deadline_days=excluded.response_deadline_days,
    comments_enabled=excluded.comments_enabled,is_active=true,
    is_default=excluded.is_default,sort_order=excluded.sort_order;
  -- Existing migration categories may already be referenced by a concurrently
  -- registered manager. Keep their identity and update only editable defaults.

  insert into app_private.facility_categories(
    id,label,description,is_active,is_default,sort_order,created_by
  )
  select value->>'id', btrim(value->>'label'), btrim(coalesce(value->>'description','')),
    true, ordinal = 1, ordinal - 1, backend_complete_initial_setup.actor_uid
  from jsonb_array_elements(facility_categories) with ordinality as items(value, ordinal)
  on conflict (id) do update set
    label=excluded.label,description=excluded.description,is_active=true,
    is_default=excluded.is_default,sort_order=excluded.sort_order;

  update app_private.system_setup set completed_at=now(),completed_by=actor_uid,updated_at=now()
  where singleton;
  insert into app_private.category_configuration_audit(domain,operation,actor_uid,after_value)
  values('setup','complete-setup',actor_uid,jsonb_build_object(
    'issueCategoryCount',jsonb_array_length(issue_categories),
    'facilityCategoryCount',jsonb_array_length(facility_categories)
  ));
  return jsonb_build_object('success',true,'setupCompleted',true);
end;
$$;

create or replace function app_api.backend_create_facility(
  actor_uid text, actor_name text, actor_photo_url text,
  facility_title text, facility_location text, facility_content text,
  facility_category text
)
returns jsonb language plpgsql security definer
set search_path = app_private, app_api, public as $$
declare facility app_private.facility_reports%rowtype;
begin
  if not exists(select 1 from app_private.facility_categories where id=facility_category and is_active)
    then raise exception 'invalid-facility-category'; end if;
  insert into app_private.facility_reports(
    author_uid,author_name,author_photo_url,title,title_search,location,content,last_actor_uid,category_id
  ) values(
    actor_uid,actor_name,actor_photo_url,facility_title,lower(facility_title),facility_location,
    facility_content,actor_uid,facility_category
  ) returning * into facility;
  insert into app_private.outbox_events(event_type,target_type,target_id,actor_uid,payload)
  values('facility.created','facility',facility.id::text,actor_uid,jsonb_build_object(
    'title',facility.title,'category_id',facility.category_id
  ));
  return to_jsonb(facility) || jsonb_build_object(
    'isOwnFacility',true,'currentUserAffected',true,'canManageFacility',false
  );
end;
$$;

create or replace function app_api.backend_get_access_context(actor_uid text)
returns jsonb language sql stable security definer
set search_path = app_private, app_api, public as $$
  with assigned_roles as (
    select role_code from app_private.user_role_assignments
    where uid=backend_get_access_context.actor_uid
  ), assigned_issue_categories as (
    select category_id from app_private.user_issue_category_assignments
    where uid=backend_get_access_context.actor_uid
  ), assigned_facility_categories as (
    select category_id from app_private.user_facility_category_assignments
    where uid=backend_get_access_context.actor_uid
  ), granted_permissions as (
    select distinct role_permission.permission_code
    from app_private.role_permissions role_permission
    join assigned_roles assigned_role on assigned_role.role_code=role_permission.role_code
  )
  select jsonb_build_object(
    'roles',coalesce((select jsonb_agg(role_code order by role_code) from assigned_roles),'[]'::jsonb),
    'managedIssueCategoryIds',coalesce((select jsonb_agg(category_id order by category_id) from assigned_issue_categories),'[]'::jsonb),
    'managedFacilityCategoryIds',coalesce((select jsonb_agg(category_id order by category_id) from assigned_facility_categories),'[]'::jsonb),
    'permissions',coalesce((select jsonb_agg(permission_code order by permission_code) from granted_permissions),'[]'::jsonb),
    'setupCompleted',coalesce((select completed_at is not null from app_private.system_setup where singleton),false)
  );
$$;

-- Expose the proposal-time snapshots to clients. These values intentionally
-- come from the issue row rather than today's category defaults.
create or replace function app_api.backend_issue_to_json(
  issue_record app_private.issues,
  actor_uid text,
  actor_is_admin boolean,
  private_to_owner_categories text[],
  review_required_categories text[],
  author_private_categories text[]
)
returns jsonb language plpgsql stable security definer
set search_path = app_private, app_api, public as $$
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
    and issue_record.status in ('under-review','review-rejected') then
    raise exception 'not-found';
  end if;
  select exists(select 1 from app_private.supports support
    where support.issue_id=issue_record.id and support.uid=actor_uid) into current_user_supported;
  return jsonb_build_object(
    'id',issue_record.id,'title',issue_record.title,'content',issue_record.content,
    'created_at',issue_record.created_at,'closed_at',issue_record.closed_at,
    'created_at_ms',floor(extract(epoch from issue_record.created_at)*1000),
    'closed_at_ms',case when issue_record.closed_at is null then null else floor(extract(epoch from issue_record.closed_at)*1000) end,
    'support_count',issue_record.support_count,'status',issue_record.status,'category',issue_record.category,
    'comments_enabled',issue_record.comments_enabled,'read_access',issue_record.read_access,
    'support_enabled',issue_record.support_enabled,
    'support_goal',issue_record.support_goal,'support_deadline_at',issue_record.support_deadline_at,
    'support_deadline_at_ms',case when issue_record.support_deadline_at is null then null else floor(extract(epoch from issue_record.support_deadline_at)*1000) end,
    'response_deadline_at',issue_record.response_deadline_at,
    'response_deadline_at_ms',case when issue_record.response_deadline_at is null then null else floor(extract(epoch from issue_record.response_deadline_at)*1000) end,
    'review_approved_at',issue_record.review_approved_at,
    'review_approved_at_ms',case when issue_record.review_approved_at is null then null else floor(extract(epoch from issue_record.review_approved_at)*1000) end,
    'result_content',issue_record.result_content,'support_met_at',issue_record.support_met_at,
    'support_met_at_ms',case when issue_record.support_met_at is null then null else floor(extract(epoch from issue_record.support_met_at)*1000) end,
    'review_rejection_reason',issue_record.review_rejection_reason,
    'currentUserSupported',current_user_supported,'isOwnIssue',is_own_issue,
    'canManageIssue',can_manage_issue,'canViewAuthor',can_view_author,
    'author_uid',case when can_view_author then issue_record.author_uid else null end,
    'author_name',case when can_view_author then issue_record.author_name else null end,
    'author_photo_url',case when can_view_author then issue_record.author_photo_url else null end
  );
end;
$$;

create or replace function app_api.backend_issue_list_to_json(
  issue_record app_private.issues,
  actor_uid text,
  actor_is_admin boolean,
  current_user_supported boolean,
  private_to_owner_categories text[],
  review_required_categories text[],
  author_private_categories text[]
)
returns jsonb language plpgsql stable security definer
set search_path = app_private, app_api, public as $$
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
    'support_enabled',issue_record.support_enabled,
    'support_goal',issue_record.support_goal,'support_deadline_at',issue_record.support_deadline_at,
    'support_deadline_at_ms',case when issue_record.support_deadline_at is null then null else floor(extract(epoch from issue_record.support_deadline_at)*1000) end,
    'response_deadline_at',issue_record.response_deadline_at,
    'response_deadline_at_ms',case when issue_record.response_deadline_at is null then null else floor(extract(epoch from issue_record.response_deadline_at)*1000) end,
    'review_approved_at',issue_record.review_approved_at,
    'review_approved_at_ms',case when issue_record.review_approved_at is null then null else floor(extract(epoch from issue_record.review_approved_at)*1000) end,
    'result_content',issue_record.result_content,'support_met_at',issue_record.support_met_at,
    'support_met_at_ms',case when issue_record.support_met_at is null then null else floor(extract(epoch from issue_record.support_met_at)*1000) end,
    'review_rejection_reason',issue_record.review_rejection_reason,
    'currentUserSupported',current_user_supported,'isOwnIssue',is_own_issue,
    'canManageIssue',can_manage_issue,'canViewAuthor',can_view_author,
    'author_uid',case when can_view_author then issue_record.author_uid else null end,
    'author_name',case when can_view_author then issue_record.author_name else null end,
    'author_photo_url',case when can_view_author then issue_record.author_photo_url else null end
  );
end;
$$;

alter table app_private.issue_categories enable row level security;
alter table app_private.facility_categories enable row level security;
alter table app_private.user_facility_category_assignments enable row level security;
alter table app_private.category_configuration_audit enable row level security;
alter table app_private.system_setup enable row level security;

revoke all on app_private.issue_categories, app_private.facility_categories,
  app_private.user_facility_category_assignments, app_private.category_configuration_audit,
  app_private.system_setup from public, anon, authenticated;
revoke all on function app_private.prevent_issue_category_identity_change() from public,anon,authenticated;
revoke all on function app_private.touch_facility_category() from public,anon,authenticated;
revoke all on function app_private.snapshot_issue_category_defaults() from public,anon,authenticated;
revoke all on function app_private.prevent_issue_policy_snapshot_change() from public,anon,authenticated;
revoke all on function app_private.prevent_comment_when_disabled() from public,anon,authenticated;
revoke all on function app_api.backend_complete_initial_setup(text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function app_api.backend_complete_initial_setup(text,jsonb,jsonb) to service_role;
revoke all on function app_api.backend_create_facility(text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function app_api.backend_create_facility(text,text,text,text,text,text,text) to service_role;
revoke all on function app_api.backend_get_access_context(text) from public,anon,authenticated;
grant execute on function app_api.backend_get_access_context(text) to service_role;

-- The issue snapshot column shares its name with the legacy RPC argument.
-- Qualify the argument so PostgreSQL does not resolve it as the table column.
create or replace function app_api.backend_toggle_support(
  issue_id uuid, actor_uid text, remove_support boolean, response_deadline_days integer
)
returns table(supported boolean, support_count integer, goal_met boolean)
language plpgsql security definer set search_path = app_private, app_api, public as $$
declare issue_record app_private.issues%rowtype; existing boolean; next_count integer; reached_goal boolean := false;
begin
  select * into issue_record from app_private.issues where id = issue_id for update;
  if not found then raise exception 'not-found'; end if;
  if issue_record.author_uid = actor_uid then raise exception 'support-not-available'; end if;
  if issue_record.status <> 'pending' or not issue_record.support_enabled or issue_record.support_met_at is not null
    or (issue_record.support_deadline_at is not null and issue_record.support_deadline_at <= now())
  then raise exception 'support-not-available'; end if;
  select exists(select 1 from app_private.supports where supports.issue_id = backend_toggle_support.issue_id and uid = actor_uid) into existing;
  if remove_support or existing then
    delete from app_private.supports where supports.issue_id = backend_toggle_support.issue_id and uid = actor_uid;
    supported := false;
  else
    insert into app_private.supports(issue_id, uid) values (backend_toggle_support.issue_id, actor_uid);
    supported := true;
  end if;
  select issues.support_count into next_count from app_private.issues where id = backend_toggle_support.issue_id;
  if supported and issue_record.support_goal is not null and next_count >= issue_record.support_goal then
    update app_private.issues set support_met_at = coalesce(support_met_at, now()),
      response_deadline_at = case
        when backend_toggle_support.response_deadline_days is null then null
        else now() + make_interval(days => backend_toggle_support.response_deadline_days)
      end
    where id = backend_toggle_support.issue_id and support_met_at is null;
    reached_goal := found;
  end if;
  if reached_goal then
    insert into app_private.outbox_events(event_type,target_type,target_id,actor_uid,payload)
    values ('support.goal_met','issue',issue_id::text,actor_uid,jsonb_build_object(
      'author_uid',issue_record.author_uid,'issue_category',issue_record.category,
      'new_support_count',next_count,'support_goal',issue_record.support_goal,'title',issue_record.title));
  end if;
  support_count := next_count; goal_met := reached_goal; return next;
end;
$$;
