-- 0019_search_content_and_author.sql
-- Widen a feed search from the title to the body and the author's name.
-- A member looking for something they read remembers a phrase from it, or who
-- wrote it, far more often than the exact words of its title, and a title-only
-- match sent them back to scrolling. The reach stays where the feed already is:
-- the selected category and status bucket, one page at a time.
-- An issue whose category hides its author keeps that author out of the match,
-- so a name can never be used to confirm who wrote it.

create or replace function app_private.search_like_pattern(search_query text)
returns text
language sql
immutable
set search_path to 'pg_catalog'
as $$
  select '%' || replace(replace(replace(
    lower(btrim(coalesce(search_query, ''))), '\', '\\'), '%', '\%'), '_', '\_') || '%'
$$;

create or replace function app_private.issue_matches_search(
  issue_record app_private.issues,
  actor_uid text,
  actor_is_admin boolean,
  search_query text
) returns boolean
language sql
stable
security definer
set search_path to 'app_private', 'public'
as $$
  select case
    when coalesce(btrim(search_query), '') = '' then true
    else issue_record.title_search like app_private.search_like_pattern(search_query) escape '\'
      or lower(coalesce(issue_record.content, '')) like app_private.search_like_pattern(search_query) escape '\'
      or (
        (actor_is_admin or issue_record.author_uid = actor_uid or issue_record.author_visible)
        and exists (
          select 1
          from app_private.user_profiles profile
          where profile.uid = issue_record.author_uid
            and lower(coalesce(profile.display_name, '')) like app_private.search_like_pattern(search_query) escape '\'
        )
      )
  end
$$;

create or replace function app_private.facility_matches_search(
  facility_record app_private.facility_reports,
  search_query text
) returns boolean
language sql
stable
security definer
set search_path to 'app_private', 'public'
as $$
  select case
    when coalesce(btrim(search_query), '') = '' then true
    else facility_record.title_search like app_private.search_like_pattern(search_query) escape '\'
      or lower(coalesce(facility_record.location, '')) like app_private.search_like_pattern(search_query) escape '\'
      or lower(coalesce(facility_record.content, '')) like app_private.search_like_pattern(search_query) escape '\'
      or exists (
        select 1
        from app_private.user_profiles profile
        where profile.uid = facility_record.author_uid
          and lower(coalesce(profile.display_name, '')) like app_private.search_like_pattern(search_query) escape '\'
      )
  end
$$;

CREATE OR REPLACE FUNCTION "app_api"."backend_list_issues"("action_name" "text", "actor_uid" "text", "actor_is_admin" boolean, "active_filter" "text", "status_bucket" "text", "sort_name" "text", "page_size" integer, "title_query" "text", "cursor_id" "uuid", "cursor_created_at" timestamp with time zone, "cursor_sort_date" timestamp with time zone, "cursor_sort_number" integer, "private_to_owner_categories" "text"[], "review_required_categories" "text"[], "author_private_categories" "text"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare
  effective_sort_name text := case
    when coalesce(status_bucket, 'active') = 'closed' then 'latest'
    else coalesce(sort_name, 'latest')
  end;
  limited_page_size integer := least(greatest(coalesce(page_size, 30), 1), 50);
  rows_json jsonb := '[]'::jsonb;
  last_issue jsonb;
  page_row record;
begin
  for page_row in
    select
      issue_record,
      exists (
        select 1
        from app_private.supports support
        where support.issue_id = issue_record.id
          and support.uid = actor_uid
      ) as current_user_supported
    from app_private.issues issue_record
    where issue_record.category = active_filter
      and (
        actor_is_admin
        or issue_record.author_uid = actor_uid
        or issue_record.category <> all(private_to_owner_categories)
      )
      and (
        actor_is_admin
        or issue_record.author_uid = actor_uid
        or not (
          issue_record.category = any(review_required_categories)
          and issue_record.status in ('under-review', 'review-rejected')
        )
      )
      and (
        case
          when coalesce(status_bucket, 'active') = 'closed' then
            case
              when actor_is_admin or issue_record.category = any(private_to_owner_categories)
                then issue_record.status in ('auto-rejected', 'review-rejected', 'infeasible', 'completed')
              else issue_record.status in ('auto-rejected', 'infeasible', 'completed')
                or (issue_record.author_uid = actor_uid and issue_record.status = 'review-rejected')
            end
          else
            case
              when actor_is_admin or issue_record.category = any(private_to_owner_categories)
                then issue_record.status in ('under-review', 'pending', 'processing')
              else issue_record.status in ('pending', 'processing')
                or (issue_record.author_uid = actor_uid and issue_record.status = 'under-review')
            end
        end
      )
      and (
        action_name <> 'searchIssues'
        or app_private.issue_matches_search(issue_record, actor_uid, actor_is_admin, title_query)
      )
      and (
        cursor_id is null
        or case
          when effective_sort_name = 'most-supported' and cursor_sort_number is not null then
            issue_record.support_count < cursor_sort_number
            or (
              issue_record.support_count = cursor_sort_number
              and app_private.issue_list_sort_date(issue_record, status_bucket, effective_sort_name)
                < coalesce(cursor_sort_date, cursor_created_at)
            )
            or (
              issue_record.support_count = cursor_sort_number
              and app_private.issue_list_sort_date(issue_record, status_bucket, effective_sort_name)
                = coalesce(cursor_sort_date, cursor_created_at)
              and issue_record.id < cursor_id
            )
          when effective_sort_name = 'ending-soon' and cursor_sort_date is not null then
            issue_record.support_deadline_at > cursor_sort_date
            or (
              issue_record.support_deadline_at = cursor_sort_date
              and issue_record.created_at < cursor_created_at
            )
            or (
              issue_record.support_deadline_at = cursor_sort_date
              and issue_record.created_at = cursor_created_at
              and issue_record.id < cursor_id
            )
          when effective_sort_name = 'ending-soon' and cursor_sort_date is null then
            issue_record.support_deadline_at is null
            and (
              issue_record.created_at < cursor_created_at
              or (issue_record.created_at = cursor_created_at and issue_record.id < cursor_id)
            )
          else
            app_private.issue_list_sort_date(issue_record, status_bucket, effective_sort_name)
              < coalesce(cursor_sort_date, cursor_created_at)
            or (
              app_private.issue_list_sort_date(issue_record, status_bucket, effective_sort_name)
                = coalesce(cursor_sort_date, cursor_created_at)
              and issue_record.id < cursor_id
            )
        end
      )
    order by
      case when effective_sort_name = 'most-supported' then issue_record.support_count end desc,
      case when effective_sort_name = 'ending-soon' then issue_record.support_deadline_at end asc nulls last,
      case when effective_sort_name = 'ending-soon' then issue_record.created_at end desc,
      case when effective_sort_name <> 'ending-soon'
        then app_private.issue_list_sort_date(issue_record, status_bucket, effective_sort_name)
      end desc,
      issue_record.id desc
    limit limited_page_size + 1
  loop
    rows_json := rows_json || jsonb_build_array(app_api.backend_issue_list_to_json(
      page_row.issue_record,
      actor_uid,
      actor_is_admin,
      page_row.current_user_supported,
      private_to_owner_categories,
      review_required_categories,
      author_private_categories
    ));
  end loop;

  last_issue := rows_json -> (limited_page_size - 1);
  return jsonb_build_object(
    'issues', (
      select coalesce(jsonb_agg(value), '[]'::jsonb)
      from (
        select value
        from jsonb_array_elements(rows_json) with ordinality as items(value, position)
        where position <= limited_page_size
        order by position
      ) limited_rows
    ),
    'hasMore', jsonb_array_length(rows_json) > limited_page_size,
    'limited', jsonb_array_length(rows_json) > limited_page_size,
    'cursor', case
      when jsonb_array_length(rows_json) > limited_page_size and last_issue is not null then
        jsonb_build_object(
          'id', last_issue ->> 'id',
          'created_at', last_issue -> 'created_at_ms',
          'sort_date', case
            when effective_sort_name = 'ending-soon' then last_issue -> 'support_deadline_at_ms'
            when coalesce(status_bucket, 'active') = 'closed'
              then coalesce(last_issue -> 'closed_at_ms', last_issue -> 'created_at_ms')
            else coalesce(last_issue -> 'review_approved_at_ms', last_issue -> 'created_at_ms')
          end,
          'sort_number', case
            when effective_sort_name = 'most-supported' then last_issue -> 'support_count'
            else null
          end
        )
      else null
    end
  );
end;
$$;

CREATE OR REPLACE FUNCTION "app_api"."backend_list_facilities"("actor_uid" "text", "actor_is_admin" boolean, "managed_category_ids" "text"[], "category_filter" "text", "bucket" "text", "status_filter" "text", "search_query" "text", "sort_name" "text", "cursor_created_at" timestamp with time zone, "cursor_number" integer, "cursor_id" "uuid", "page_size" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare
  rows_json jsonb;
  fetched integer;
  effective_size integer := least(greatest(page_size,1),50);
begin
  if not exists(select 1 from app_private.facility_categories category
    where category.id=category_filter and category.is_active) then
    raise exception 'invalid-facility-category';
  end if;
  with candidates as (
    select facility.*,
      facility.author_uid=actor_uid or exists(
        select 1 from app_private.facility_report_affected_users affected
        where affected.facility_id=facility.id and affected.uid=actor_uid
      ) as current_user_affected,
      actor_is_admin or facility.category_id=any(coalesce(managed_category_ids,array[]::text[])) as can_manage_facility
    from app_private.facility_reports facility
    where facility.category_id=category_filter
      and (case when bucket='closed' then facility.status in ('completed','unable-to-handle')
        else facility.status in ('pending','processing') end)
      and (coalesce(status_filter,'')='' or facility.status=status_filter)
      and app_private.facility_matches_search(facility, search_query)
      and (cursor_id is null or case when sort_name='most-affected'
        then (facility.affected_count,facility.id)<(cursor_number,cursor_id)
        else (facility.created_at,facility.id)<(cursor_created_at,cursor_id) end)
    order by case when sort_name='most-affected' then facility.affected_count end desc,
      case when sort_name<>'most-affected' then facility.created_at end desc,facility.id desc
    limit effective_size+1
  ), selected as (select * from candidates limit effective_size)
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'category_id',category_id,'title',title,'location',location,
    'status',status,'affected_count',affected_count,'author_uid',author_uid,
    'created_at',created_at,'updated_at',updated_at,'isOwnFacility',author_uid=actor_uid,
    'currentUserAffected',current_user_affected,'canManageFacility',can_manage_facility
  ) order by case when sort_name='most-affected' then affected_count end desc,
    case when sort_name<>'most-affected' then created_at end desc,id desc),'[]'::jsonb),
    (select count(*) from candidates)
  into rows_json,fetched from selected;
  return jsonb_build_object('facilities',rows_json,'hasMore',fetched>effective_size);
end;
$$;

grant execute on all functions in schema app_private, app_api to novae_runtime;
