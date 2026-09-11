-- 0018_list_status_counts.sql
-- Carry a per-status count of the whole category on every first list page, so a
-- member can see how much is in each state instead of only how empty a page is.
-- The count describes the category, not the page: it ignores the status bucket, and
-- a later page or a title search reuses the count the first page already carried.
-- It is an aggregate over the category and exposes volume, never content.

create or replace function app_api.backend_list_issues_snapshot(
  action_name text,
  actor_uid text,
  actor_can_manage boolean,
  active_filter text,
  status_bucket text,
  sort_name text,
  page_size integer,
  title_query text,
  cursor_id uuid,
  cursor_created_at timestamptz,
  cursor_sort_date timestamptz,
  cursor_sort_number integer
) returns jsonb
language plpgsql
stable
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
declare
  private_to_owner_categories text[];
  review_required_categories text[];
  author_private_categories text[];
  result jsonb;
  content_version bigint;
  status_counts jsonb := '{}'::jsonb;
begin
  if not exists (
    select 1
    from app_private.issue_categories category
    where category.id = active_filter and category.is_active
  ) then
    raise exception 'invalid-issue-category';
  end if;

  select
    coalesce(array_agg(id) filter (where read_access = 'owner-admin'), array[]::text[]),
    coalesce(array_agg(id) filter (where read_access = 'reviewed-school'), array[]::text[]),
    coalesce(array_agg(id) filter (where not author_visible), array[]::text[])
  into private_to_owner_categories, review_required_categories, author_private_categories
  from app_private.issue_categories;

  if cursor_id is null and coalesce(title_query, '') = '' then
    select coalesce(jsonb_object_agg(grouped.status, grouped.total), '{}'::jsonb)
    into status_counts
    from (
      select status, count(*)::integer as total
      from app_private.issues
      where category = active_filter
      group by status
    ) grouped;
  end if;

  result := app_api.backend_list_issues(
    action_name, actor_uid, actor_can_manage, active_filter, status_bucket,
    sort_name, page_size, title_query, cursor_id, cursor_created_at,
    cursor_sort_date, cursor_sort_number, private_to_owner_categories,
    review_required_categories, author_private_categories
  );
  select version into content_version
  from app_private.content_versions
  where domain = 'issues';
  return coalesce(result, '{}'::jsonb) || jsonb_build_object(
    'statusCounts', status_counts,
    'version', coalesce(content_version, 1)
  );
end;
$$;

create or replace function app_api.backend_list_user_issues_snapshot(
  actor_uid text,
  actor_is_admin boolean,
  status_bucket text,
  sort_name text,
  page_size integer,
  cursor_id uuid,
  cursor_created_at timestamptz,
  cursor_sort_date timestamptz,
  cursor_sort_number integer
) returns jsonb
language plpgsql
stable
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
declare
  private_to_owner_categories text[];
  review_required_categories text[];
  author_private_categories text[];
  result jsonb;
  content_version bigint;
  status_counts jsonb := '{}'::jsonb;
begin
  select
    coalesce(array_agg(id) filter (where read_access = 'owner-admin'), array[]::text[]),
    coalesce(array_agg(id) filter (where read_access = 'reviewed-school'), array[]::text[]),
    coalesce(array_agg(id) filter (where not author_visible), array[]::text[])
  into private_to_owner_categories, review_required_categories, author_private_categories
  from app_private.issue_categories;

  if cursor_id is null then
    select coalesce(jsonb_object_agg(grouped.status, grouped.total), '{}'::jsonb)
    into status_counts
    from (
      select status, count(*)::integer as total
      from app_private.issues
      where author_uid = backend_list_user_issues_snapshot.actor_uid
      group by status
    ) grouped;
  end if;

  result := app_api.backend_list_user_issues(
    actor_uid, actor_is_admin, status_bucket, sort_name, page_size, cursor_id,
    cursor_created_at, cursor_sort_date, cursor_sort_number,
    private_to_owner_categories, review_required_categories, author_private_categories
  );
  select version into content_version
  from app_private.content_versions
  where domain = 'issues';
  return coalesce(result, '{}'::jsonb) || jsonb_build_object(
    'statusCounts', status_counts,
    'version', coalesce(content_version, 1)
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
  result jsonb;
  content_version bigint;
  status_counts jsonb := '{}'::jsonb;
begin
  if cursor_id is null then
    select coalesce(jsonb_object_agg(grouped.status, grouped.total), '{}'::jsonb)
    into status_counts
    from (
      select status, count(*)::integer as total
      from app_private.facility_reports
      where category_id = category_filter
      group by status
    ) grouped;
  end if;

  result := app_api.backend_list_facilities(
    actor_uid, actor_is_admin, managed_category_ids, category_filter, bucket,
    status_filter, search_query, sort_name, cursor_created_at, cursor_number,
    cursor_id, page_size
  );
  select version into content_version
  from app_private.content_versions
  where domain = 'facilities';
  return coalesce(result, '{}'::jsonb) || jsonb_build_object(
    'statusCounts', status_counts,
    'version', coalesce(content_version, 1)
  );
end;
$$;
