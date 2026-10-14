-- A facility report leaves the database in the shape the API answers with,
-- as proposals and announcements already do (see 0062).
--
-- Reports were the row itself (`to_jsonb`), snake_case and carrying internal
-- columns such as `title_search` and `last_actor_uid`, which the Worker then
-- renamed on the way out. One builder now names exactly the fields a report
-- has, and a list entry is the same builder without the page-only fields.
--
-- Deleting a report that is already gone is `not-found`, not a success that
-- names nobody to tell.

create or replace function app_api.backend_facility_fields(
  facility app_private.facility_reports,
  actor_uid text,
  current_user_affected boolean,
  can_manage boolean
)
returns jsonb
language sql
stable
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
  select jsonb_build_object(
    'id', facility.id,
    'categoryId', facility.category_id,
    'title', facility.title,
    'location', facility.location,
    'status', facility.status,
    'affectedCount', facility.affected_count,
    'authorUid', facility.author_uid,
    'createdAt', facility.created_at,
    'updatedAt', facility.updated_at,
    'isOwnFacility', facility.author_uid = actor_uid,
    'currentUserAffected', current_user_affected,
    'canManageFacility', can_manage,
    'content', facility.content,
    'resultContent', facility.result_content,
    'startedAt', facility.started_at,
    'closedAt', facility.closed_at
  );
$$;

revoke all on function app_api.backend_facility_fields(app_private.facility_reports, text, boolean, boolean) from public;

create or replace function app_api.backend_facility_affected(facility app_private.facility_reports, actor_uid text)
returns boolean
language sql
stable
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
  select facility.author_uid = actor_uid or exists(
    select 1 from app_private.facility_report_affected_users affected
    where affected.facility_id = facility.id and affected.uid = actor_uid
  );
$$;

revoke all on function app_api.backend_facility_affected(app_private.facility_reports, text) from public;

create or replace function app_api.backend_get_facility(facility_id uuid, actor_uid text, actor_can_manage boolean)
returns jsonb
language plpgsql
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
declare
  facility app_private.facility_reports%rowtype;
begin
  select * into facility from app_private.facility_reports where id = facility_id;
  if not found then raise exception 'not-found'; end if;
  return app_api.backend_facility_fields(
    facility, actor_uid, app_api.backend_facility_affected(facility, actor_uid), actor_can_manage
  );
end;
$$;

create or replace function app_api.backend_create_facility(
  actor_uid text,
  facility_title text,
  facility_location text,
  facility_content text,
  facility_category text
)
returns jsonb
language plpgsql
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
declare
  facility app_private.facility_reports%rowtype;
begin
  insert into app_private.facility_reports(
    title, title_search, location, content, category_id, author_uid, last_actor_uid, status
  ) values (
    facility_title, lower(facility_title), facility_location, facility_content,
    facility_category, actor_uid, actor_uid, 'pending'
  ) returning * into facility;
  return app_api.backend_facility_fields(facility, actor_uid, true, false);
end;
$$;

create or replace function app_api.backend_update_facility_status(
  facility_id uuid,
  actor_uid text,
  actor_can_manage boolean,
  next_status text,
  result_content text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
declare
  report_record app_private.facility_reports%rowtype;
begin
  select * into report_record
  from app_private.facility_reports where id = facility_id for update;
  if not found then raise exception 'not-found'; end if;
  if not actor_can_manage then raise exception 'permission-denied'; end if;
  if next_status in ('completed', 'unable-to-handle') and coalesce(length(btrim(backend_update_facility_status.result_content)), 0) = 0 then
    raise exception 'missing-result';
  end if;

  update app_private.facility_reports
  set status = next_status,
      result_content = coalesce(backend_update_facility_status.result_content, facility_reports.result_content),
      last_actor_uid = actor_uid,
      closed_at = case when next_status in ('completed', 'unable-to-handle') then now() else null end,
      started_at = case when next_status = 'processing' and started_at is null then now() else started_at end,
      updated_at = now()
  where id = facility_id
  returning * into report_record;

  return app_api.backend_facility_fields(
    report_record, actor_uid, app_api.backend_facility_affected(report_record, actor_uid), true
  );
end;
$$;

create or replace function app_api.backend_toggle_facility_affected(facility_id uuid, actor_uid text)
returns jsonb
language plpgsql
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
declare
  facility app_private.facility_reports%rowtype;
  now_affected boolean;
begin
  select * into facility from app_private.facility_reports where id = facility_id for update;
  if not found then raise exception 'not-found'; end if;
  if facility.author_uid = actor_uid then raise exception 'facility-author-fixed'; end if;
  if facility.status in ('completed', 'unable-to-handle') then raise exception 'facility-closed'; end if;
  delete from app_private.facility_report_affected_users
  where facility_report_affected_users.facility_id = backend_toggle_facility_affected.facility_id and uid = actor_uid;
  if found then
    now_affected := false;
  else
    insert into app_private.facility_report_affected_users(facility_id, uid)
    values (backend_toggle_facility_affected.facility_id, actor_uid);
    now_affected := true;
  end if;
  update app_private.facility_reports
  set affected_count = affected_count + case when now_affected then 1 else -1 end, updated_at = now()
  where id = facility_id
  returning * into facility;
  return jsonb_build_object('affected', now_affected, 'affectedCount', facility.affected_count);
end;
$$;

create or replace function app_api.backend_delete_facility(
  facility_id uuid,
  actor_uid text,
  actor_can_manage boolean,
  author_delete_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
declare
  report_record app_private.facility_reports%rowtype;
begin
  select * into report_record
  from app_private.facility_reports where id = facility_id for update;
  if not found then raise exception 'not-found'; end if;
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
$$;

create or replace function app_api.backend_list_facilities(
  actor_uid text,
  actor_is_admin boolean,
  managed_category_ids text[],
  category_filter text,
  bucket text,
  status_filter text,
  search_query text,
  sort_name text,
  cursor_created_at timestamptz,
  cursor_number integer,
  cursor_id uuid,
  page_size integer
)
returns jsonb
language plpgsql
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
declare
  rows_json jsonb;
  last_row jsonb;
  fetched integer;
  effective_size integer := least(greatest(page_size, 1), 50);
begin
  if not exists(select 1 from app_private.facility_categories category
    where category.id = category_filter and category.is_active) then
    raise exception 'invalid-facility-category';
  end if;
  with candidates as (
    select facility
    from app_private.facility_reports facility
    where facility.category_id = category_filter
      and (case when bucket = 'closed' then facility.status in ('completed', 'unable-to-handle')
        else facility.status in ('pending', 'processing') end)
      and (coalesce(status_filter, '') = '' or facility.status = status_filter)
      and (coalesce(btrim(search_query), '') = '' or facility.id in (
        select candidate.id from app_private.facility_reports candidate
        where candidate.category_id = category_filter
          and candidate.title_search like app_private.search_like_pattern(search_query) escape '\'
        union
        select candidate.id from app_private.facility_reports candidate
        where candidate.category_id = category_filter
          and lower(candidate.location) like app_private.search_like_pattern(search_query) escape '\'
        union
        select candidate.id from app_private.facility_reports candidate
        where candidate.category_id = category_filter
          and lower(coalesce(candidate.content, '')) like app_private.search_like_pattern(search_query) escape '\'
        union
        select candidate.id from app_private.user_profiles profile
        join app_private.facility_reports candidate on candidate.author_uid = profile.uid
        where candidate.category_id = category_filter
          and lower(coalesce(profile.display_name, '')) like app_private.search_like_pattern(search_query) escape '\'
      ))
      and (cursor_id is null or case when sort_name = 'most-affected'
        then (facility.affected_count, facility.id) < (cursor_number, cursor_id)
        else (facility.created_at, facility.id) < (cursor_created_at, cursor_id) end)
    order by case when sort_name = 'most-affected' then facility.affected_count end desc,
      case when sort_name <> 'most-affected' then facility.created_at end desc, facility.id desc
    limit effective_size + 1
  ), selected as (
    select facility from candidates
    order by case when sort_name = 'most-affected' then (facility).affected_count end desc,
      case when sort_name <> 'most-affected' then (facility).created_at end desc, (facility).id desc
    limit effective_size
  )
  select
    coalesce(jsonb_agg(
      app_api.backend_facility_fields(
        facility, actor_uid, app_api.backend_facility_affected(facility, actor_uid),
        actor_is_admin or (facility).category_id = any(coalesce(managed_category_ids, array[]::text[]))
      ) - 'content' - 'resultContent' - 'startedAt' - 'closedAt'
      order by case when sort_name = 'most-affected' then (facility).affected_count end desc,
        case when sort_name <> 'most-affected' then (facility).created_at end desc, (facility).id desc
    ), '[]'::jsonb),
    (select count(*) from candidates)
  into rows_json, fetched
  from selected;

  last_row := rows_json -> -1;
  return jsonb_build_object(
    'facilities', rows_json,
    'hasMore', fetched > effective_size,
    'cursor', case when fetched > effective_size then jsonb_build_object(
      'id', last_row -> 'id',
      'createdAt', last_row -> 'createdAt',
      'affectedCount', last_row -> 'affectedCount'
    ) else null end
  );
end;
$$;

create or replace function app_api.backend_list_facilities_snapshot(
  actor_uid text,
  actor_is_admin boolean,
  managed_category_ids text[],
  category_filter text,
  bucket text,
  status_filter text,
  search_query text,
  sort_name text,
  cursor_created_at timestamptz,
  cursor_number integer,
  cursor_id uuid,
  page_size integer
) returns jsonb
language plpgsql
stable
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
declare
  status_counts jsonb := null;
begin
  -- Counted for the first page only; a later page leaves the counts it was
  -- opened with in place.
  if cursor_id is null then
    select jsonb_object_agg(status, (
      select count(*) from app_private.facility_reports report
      where report.category_id = category_filter and report.status = statuses.status
    ))
    into status_counts
    from unnest(array['pending', 'processing', 'completed', 'unable-to-handle']) as statuses(status);
  end if;

  return app_api.backend_list_facilities(
    actor_uid, actor_is_admin, managed_category_ids, category_filter, bucket,
    status_filter, search_query, sort_name, cursor_created_at, cursor_number,
    cursor_id, page_size
  ) || jsonb_build_object(
    'statusCounts', status_counts,
    'version', (select version from app_private.content_versions where domain = 'facilities')
  );
end;
$$;
