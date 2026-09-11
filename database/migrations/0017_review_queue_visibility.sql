-- 0017_review_queue_visibility.sql
-- Surface an aggregate review-queue count without exposing private proposal data.

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
  under_review_count integer := 0;
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

  if not actor_can_manage
    and status_bucket = 'active'
    and title_query is null
    and active_filter = any(review_required_categories)
  then
    select count(*)::integer
    into under_review_count
    from app_private.issues
    where category = active_filter and status = 'under-review';
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
    'underReviewCount', under_review_count,
    'version', coalesce(content_version, 1)
  );
end;
$$;
