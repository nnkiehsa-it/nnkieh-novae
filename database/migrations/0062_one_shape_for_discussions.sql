-- Every proposal, announcement and comment leaves the database in the one
-- shape the API answers with: camelCase keys and timestamps as timestamps.
--
-- A proposal used to have two spellings. Its own page was camelCase; a list
-- entry was snake_case with a millisecond copy of every instant, which the
-- Worker then renamed on the way out, so `created_at` and `created_at_ms` both
-- became `createdAt` and whichever came second won. Page cursors carried
-- milliseconds while the rows they point at keep microseconds. Both spellings
-- now come from one builder, and a cursor carries the instants themselves.
--
-- `coalesce(last_issue -> 'closedAt', ...)` never fell through: a JSON null is
-- not an SQL null, so an open proposal's cursor had no sort date. The JSON
-- null is now taken for what it is.
--
-- Deleting a proposal or a comment that is already gone is `not-found`, not a
-- success that names nobody to tell.
--
-- An author supports their own proposal implicitly (see 0031), so the answer
-- says so instead of every reader adding it back. `canManageIssue` is dropped:
-- what a reader may moderate is decided by their access, not by the row.

create or replace function app_api.backend_issue_fields(
  issue_record app_private.issues,
  actor_uid text,
  actor_is_admin boolean,
  current_user_supported boolean
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
declare
  is_own_issue boolean := issue_record.author_uid = actor_uid;
  can_view_author boolean := actor_is_admin or is_own_issue or issue_record.author_visible;
begin
  if not actor_is_admin and not is_own_issue and issue_record.read_access = 'owner-admin' then
    raise exception 'not-found';
  end if;
  if not actor_is_admin and not is_own_issue and issue_record.read_access = 'reviewed-school'
    and issue_record.status in ('under-review', 'review-rejected') then
    raise exception 'not-found';
  end if;
  return jsonb_build_object(
    'id', issue_record.id,
    'title', issue_record.title,
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
    'currentUserSupported', current_user_supported or (is_own_issue and issue_record.support_enabled),
    'isOwnIssue', is_own_issue,
    'canViewAuthor', can_view_author,
    'authorUid', case when can_view_author then issue_record.author_uid else null end
  );
end;
$$;

revoke all on function app_api.backend_issue_fields(app_private.issues, text, boolean, boolean) from public;

create or replace function app_api.backend_issue_to_json(
  issue_record app_private.issues,
  actor_uid text,
  actor_is_admin boolean,
  private_to_owner_categories text[],
  review_required_categories text[],
  author_private_categories text[]
)
returns jsonb
language sql
stable
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
  select app_api.backend_issue_fields(
    issue_record, actor_uid, actor_is_admin,
    exists(
      select 1 from app_private.supports support
      where support.issue_id = issue_record.id and support.uid = actor_uid
    )
  ) || jsonb_build_object('content', issue_record.content);
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
returns jsonb
language sql
stable
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
  select app_api.backend_issue_fields(issue_record, actor_uid, actor_is_admin, current_user_supported);
$$;

-- Overloads nothing has called since their replacements took page sizes,
-- status buckets and searches.
drop function app_api.backend_list_issue_comments(uuid, text, boolean, uuid, timestamptz, text[], text[], text[]);
drop function app_api.backend_list_announcement_comments(uuid, uuid, timestamptz);
drop function app_api.backend_list_user_issues_snapshot(text, boolean, text, text, integer, uuid, timestamptz, timestamptz, integer);
drop function app_api.backend_list_user_issues(text, boolean, text, integer, uuid, timestamptz, timestamptz, integer, text[], text[], text[]);
drop function app_api.backend_list_user_issues(text, boolean, text, text, integer, uuid, timestamptz, timestamptz, integer, text[], text[], text[]);

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
  cursor_issue app_private.issues%rowtype;
begin
  -- Browser Date cursors have millisecond precision; restore the stored anchor.
  if cursor_id is not null then
    select * into cursor_issue from app_private.issues
    where id = cursor_id and category = active_filter;
    if found then
      cursor_created_at := cursor_issue.created_at;
      cursor_sort_date := app_private.issue_list_sort_date(cursor_issue, status_bucket, effective_sort_name);
    end if;
  end if;
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
        or coalesce(btrim(title_query), '') = ''
        or issue_record.id in (
          select candidate.id from app_private.issues candidate
          where candidate.category = active_filter
            and candidate.title_search like app_private.search_like_pattern(title_query) escape '\'
          union
          select candidate.id from app_private.issues candidate
          where candidate.category = active_filter
            and lower(coalesce(candidate.content, '')) like app_private.search_like_pattern(title_query) escape '\'
          union
          select candidate.id from app_private.user_profiles profile
          join app_private.issues candidate on candidate.author_uid = profile.uid
          where candidate.category = active_filter
            and (actor_is_admin or candidate.author_uid = actor_uid or candidate.author_visible)
            and lower(coalesce(profile.display_name, '')) like app_private.search_like_pattern(title_query) escape '\'
        )
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
          'createdAt', last_issue -> 'createdAt',
          'sortDate', case
            when effective_sort_name = 'ending-soon' then last_issue -> 'supportDeadlineAt'
            when coalesce(status_bucket, 'active') = 'closed'
              then coalesce(nullif(last_issue -> 'closedAt', 'null'::jsonb), last_issue -> 'createdAt')
            else coalesce(nullif(last_issue -> 'reviewApprovedAt', 'null'::jsonb), last_issue -> 'createdAt')
          end,
          'sortNumber', case
            when effective_sort_name = 'most-supported' then last_issue -> 'supportCount'
            else 'null'::jsonb
          end
        )
      else null
    end
  );
end;
$$;

CREATE OR REPLACE FUNCTION "app_api"."backend_list_user_issues"("actor_uid" "text", "actor_is_admin" boolean, "status_bucket" "text", "sort_name" "text", "page_size" integer, "cursor_id" "uuid", "cursor_created_at" timestamp with time zone, "cursor_sort_date" timestamp with time zone, "cursor_sort_number" integer, "private_to_owner_categories" "text"[], "review_required_categories" "text"[], "author_private_categories" "text"[], "title_query" "text") RETURNS "jsonb"
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
  supported_issue_ids uuid[] := '{}'::uuid[];
  last_issue jsonb;
  issue_record app_private.issues%rowtype;
  cursor_issue app_private.issues%rowtype;
begin
  if cursor_id is not null then
    select * into cursor_issue from app_private.issues
    where id = cursor_id and author_uid = backend_list_user_issues.actor_uid;
    if found then
      cursor_created_at := cursor_issue.created_at;
      cursor_sort_date := app_private.issue_list_sort_date(cursor_issue, status_bucket, effective_sort_name);
    end if;
  end if;
  select coalesce(array_agg(issue_id), '{}'::uuid[])
  into supported_issue_ids
  from app_private.supports
  where uid = actor_uid;

  for issue_record in
    select *
    from app_private.issues candidate
    where author_uid = backend_list_user_issues.actor_uid
      and (
        coalesce(btrim(title_query), '') = ''
        or title_search like app_private.search_like_pattern(title_query) escape '\'
        or lower(coalesce(content, '')) like app_private.search_like_pattern(title_query) escape '\'
        or exists (
          select 1 from app_private.user_profiles profile
          where profile.uid = backend_list_user_issues.actor_uid
            and lower(coalesce(profile.display_name, '')) like app_private.search_like_pattern(title_query) escape '\'
        )
      )
      and case
        when coalesce(status_bucket, 'active') = 'closed'
          then status in ('auto-rejected', 'review-rejected', 'infeasible', 'completed')
        else status in ('under-review', 'pending', 'processing')
      end
      and (
        cursor_id is null
        or case
          when effective_sort_name = 'most-supported' and cursor_sort_number is not null then
            support_count < cursor_sort_number
            or (
              support_count = cursor_sort_number
              and app_private.issue_list_sort_date(candidate, status_bucket, effective_sort_name)
                < coalesce(cursor_sort_date, cursor_created_at)
            )
            or (
              support_count = cursor_sort_number
              and app_private.issue_list_sort_date(candidate, status_bucket, effective_sort_name)
                = coalesce(cursor_sort_date, cursor_created_at)
              and id < cursor_id
            )
          when effective_sort_name = 'ending-soon' and cursor_sort_date is not null then
            support_deadline_at > cursor_sort_date
            or (support_deadline_at = cursor_sort_date and created_at < cursor_created_at)
            or (support_deadline_at = cursor_sort_date and created_at = cursor_created_at and id < cursor_id)
          when effective_sort_name = 'ending-soon' and cursor_sort_date is null then
            support_deadline_at is null
            and (created_at < cursor_created_at or (created_at = cursor_created_at and id < cursor_id))
          else
            app_private.issue_list_sort_date(candidate, status_bucket, effective_sort_name)
              < coalesce(cursor_sort_date, cursor_created_at)
            or (
              app_private.issue_list_sort_date(candidate, status_bucket, effective_sort_name)
                = coalesce(cursor_sort_date, cursor_created_at)
              and id < cursor_id
            )
        end
      )
    order by
      case when effective_sort_name = 'most-supported' then support_count end desc,
      case when effective_sort_name = 'ending-soon' then support_deadline_at end asc nulls last,
      case when effective_sort_name = 'ending-soon' then created_at end desc,
      case when effective_sort_name <> 'ending-soon'
        then app_private.issue_list_sort_date(candidate, status_bucket, effective_sort_name)
      end desc,
      id desc
    limit limited_page_size + 1
  loop
    rows_json := rows_json || jsonb_build_array(app_api.backend_issue_list_to_json(
      issue_record,
      actor_uid,
      actor_is_admin,
      issue_record.id = any(supported_issue_ids),
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
    'cursor', case
      when jsonb_array_length(rows_json) > limited_page_size and last_issue is not null then
        jsonb_build_object(
          'id', last_issue ->> 'id',
          'createdAt', last_issue -> 'createdAt',
          'sortDate', case
            when effective_sort_name = 'ending-soon' then last_issue -> 'supportDeadlineAt'
            when coalesce(status_bucket, 'active') = 'closed'
              then coalesce(nullif(last_issue -> 'closedAt', 'null'::jsonb), last_issue -> 'createdAt')
            else coalesce(nullif(last_issue -> 'reviewApprovedAt', 'null'::jsonb), last_issue -> 'createdAt')
          end,
          'sortNumber', case
            when effective_sort_name = 'most-supported' then last_issue -> 'supportCount'
            else 'null'::jsonb
          end
        )
      else null
    end
  );
end;
$$;

CREATE OR REPLACE FUNCTION "app_api"."backend_list_issue_comments"("issue_id" "uuid", "actor_uid" "text", "actor_is_admin" boolean, "cursor_id" "uuid", "cursor_created_at" timestamp with time zone, "page_size" integer, "sort_name" "text", "private_to_owner_categories" "text"[], "review_required_categories" "text"[], "public_comment_categories" "text"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare
  limited_page_size integer := least(greatest(coalesce(page_size, 30), 1), 30);
  normalized_sort text := case when sort_name = 'oldest' then 'oldest' else 'newest' end;
begin
  perform app_api.backend_assert_issue_comment_access(
    issue_id,
    actor_uid,
    actor_is_admin,
    private_to_owner_categories,
    review_required_categories,
    public_comment_categories
  );

  return (
    with root_page as materialized (
      select root.*
      from app_private.comments root
      where root.issue_id = backend_list_issue_comments.issue_id
        and root.parent_comment_id is null
        and (
          cursor_id is null
          or (normalized_sort = 'oldest' and (
            root.created_at > cursor_created_at
            or (root.created_at = cursor_created_at and root.id > cursor_id)
          ))
          or (normalized_sort = 'newest' and (
            root.created_at < cursor_created_at
            or (root.created_at = cursor_created_at and root.id < cursor_id)
          ))
        )
      order by
        case when normalized_sort = 'oldest' then root.created_at end asc,
        case when normalized_sort = 'newest' then root.created_at end desc,
        case when normalized_sort = 'oldest' then root.id end asc,
        case when normalized_sort = 'newest' then root.id end desc
      limit limited_page_size + 1
    ),
    limited_roots as materialized (
      select *
      from root_page
      order by
        case when normalized_sort = 'oldest' then created_at end asc,
        case when normalized_sort = 'newest' then created_at end desc,
        case when normalized_sort = 'oldest' then id end asc,
        case when normalized_sort = 'newest' then id end desc
      limit limited_page_size
    ),
    reply_groups as materialized (
      select
        reply.parent_comment_id,
        jsonb_agg(
          app_api.backend_comment_to_json(reply, '[]'::jsonb)
          order by reply.created_at asc, reply.id asc
        ) as replies
      from app_private.comments reply
      where reply.parent_comment_id in (select id from limited_roots)
      group by reply.parent_comment_id
    ),
    page_items as (
      select
        root.id,
        root.created_at,
        app_api.backend_comment_to_json(root, coalesce(reply_groups.replies, '[]'::jsonb)) as value
      from limited_roots root
      left join reply_groups on reply_groups.parent_comment_id = root.id
    ),
    last_item as (
      select id, created_at
      from limited_roots
      order by
        case when normalized_sort = 'oldest' then created_at end asc,
        case when normalized_sort = 'newest' then created_at end desc,
        case when normalized_sort = 'oldest' then id end asc,
        case when normalized_sort = 'newest' then id end desc
      offset (limited_page_size - 1)
      limit 1
    )
    select jsonb_build_object(
      'comments', coalesce(
        (select jsonb_agg(
          value order by
            case when normalized_sort = 'oldest' then created_at end asc,
            case when normalized_sort = 'newest' then created_at end desc,
            case when normalized_sort = 'oldest' then id end asc,
            case when normalized_sort = 'newest' then id end desc
        ) from page_items),
        '[]'::jsonb
      ),
      'hasMore', (select count(*) > limited_page_size from root_page),
      'cursor', case
        when (select count(*) > limited_page_size from root_page) then (
          select jsonb_build_object(
            'id', id,
            'createdAt', created_at
          )
          from last_item
        )
        else null
      end
    )
  );
end;
$$;

CREATE OR REPLACE FUNCTION "app_api"."backend_list_announcement_comments"("announcement_id" "uuid", "cursor_id" "uuid", "cursor_created_at" timestamp with time zone, "page_size" integer, "sort_name" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare
  limited_page_size integer := least(greatest(coalesce(page_size, 30), 1), 30);
  normalized_sort text := case when sort_name = 'oldest' then 'oldest' else 'newest' end;
begin
  return (
    with root_page as materialized (
      select root.*
      from app_private.announcement_comments root
      where root.announcement_id = backend_list_announcement_comments.announcement_id
        and root.parent_comment_id is null
        and (
          cursor_id is null
          or (normalized_sort = 'oldest' and (
            root.created_at > cursor_created_at
            or (root.created_at = cursor_created_at and root.id > cursor_id)
          ))
          or (normalized_sort = 'newest' and (
            root.created_at < cursor_created_at
            or (root.created_at = cursor_created_at and root.id < cursor_id)
          ))
        )
      order by
        case when normalized_sort = 'oldest' then root.created_at end asc,
        case when normalized_sort = 'newest' then root.created_at end desc,
        case when normalized_sort = 'oldest' then root.id end asc,
        case when normalized_sort = 'newest' then root.id end desc
      limit limited_page_size + 1
    ),
    limited_roots as materialized (
      select *
      from root_page
      order by
        case when normalized_sort = 'oldest' then created_at end asc,
        case when normalized_sort = 'newest' then created_at end desc,
        case when normalized_sort = 'oldest' then id end asc,
        case when normalized_sort = 'newest' then id end desc
      limit limited_page_size
    ),
    reply_groups as materialized (
      select
        reply.parent_comment_id,
        jsonb_agg(
          app_api.backend_announcement_comment_to_json(reply, '[]'::jsonb)
          order by reply.created_at asc, reply.id asc
        ) as replies
      from app_private.announcement_comments reply
      where reply.parent_comment_id in (select id from limited_roots)
      group by reply.parent_comment_id
    ),
    page_items as (
      select
        root.id,
        root.created_at,
        app_api.backend_announcement_comment_to_json(
          root,
          coalesce(reply_groups.replies, '[]'::jsonb)
        ) as value
      from limited_roots root
      left join reply_groups on reply_groups.parent_comment_id = root.id
    ),
    last_item as (
      select id, created_at
      from limited_roots
      order by
        case when normalized_sort = 'oldest' then created_at end asc,
        case when normalized_sort = 'newest' then created_at end desc,
        case when normalized_sort = 'oldest' then id end asc,
        case when normalized_sort = 'newest' then id end desc
      offset (limited_page_size - 1)
      limit 1
    )
    select jsonb_build_object(
      'comments', coalesce(
        (select jsonb_agg(
          value order by
            case when normalized_sort = 'oldest' then created_at end asc,
            case when normalized_sort = 'newest' then created_at end desc,
            case when normalized_sort = 'oldest' then id end asc,
            case when normalized_sort = 'newest' then id end desc
        ) from page_items),
        '[]'::jsonb
      ),
      'hasMore', (select count(*) > limited_page_size from root_page),
      'cursor', case
        when (select count(*) > limited_page_size from root_page) then (
          select jsonb_build_object(
            'id', id,
            'createdAt', created_at
          )
          from last_item
        )
        else null
      end
    )
  );
end;
$$;

CREATE OR REPLACE FUNCTION "app_api"."backend_list_announcements"("actor_uid" "text", "page_size" integer, "cursor_id" "uuid", "cursor_published_at" timestamp with time zone) RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
  with settings as (
    select least(greatest(coalesce(page_size,30),1),50) as limited_page_size,
      coalesce((select announcement_comments_enabled from app_private.system_setup where singleton),false)
        as global_comments_enabled
  ), liked_ids as materialized (
    select announcement_id from app_private.announcement_likes where uid=actor_uid
  ), page_rows as materialized (
    select announcement.id,announcement.author_uid,announcement.title,
      announcement.like_count,announcement.comment_count,announcement.comments_enabled,
      (select global_comments_enabled from settings) as comments_globally_enabled,
      announcement.published_at,liked_ids.announcement_id is not null as current_user_liked
    from app_private.announcements announcement
    left join liked_ids on liked_ids.announcement_id=announcement.id
    where cursor_id is null or announcement.published_at<cursor_published_at
      or (announcement.published_at=cursor_published_at and announcement.id<cursor_id)
    order by announcement.published_at desc,announcement.id desc
    limit (select limited_page_size+1 from settings)
  ), limited_rows as (
    select * from page_rows order by published_at desc,id desc
    limit (select limited_page_size from settings)
  ), last_item as (
    select id,published_at from limited_rows order by published_at asc,id asc limit 1
  )
  select jsonb_build_object(
    'announcements',coalesce((select jsonb_agg(jsonb_build_object(
      'id',id,'authorUid',author_uid,'title',title,'likeCount',like_count,
      'commentCount',comment_count,'commentsEnabled',comments_enabled,
      'commentsGloballyEnabled',comments_globally_enabled,
      'publishedAt',published_at,
      'currentUserLiked',current_user_liked
    ) order by published_at desc,id desc) from limited_rows),'[]'::jsonb),
    'hasMore',(select count(*)>(select limited_page_size from settings) from page_rows),
    'cursor',case when (select count(*)>(select limited_page_size from settings) from page_rows)
      then (select jsonb_build_object('id',id,'publishedAt',published_at) from last_item)
      else null end
  );
$$;

CREATE OR REPLACE FUNCTION "app_api"."backend_create_announcement_comment"("announcement_id" "uuid", "parent_comment_id" "uuid", "actor_uid" "text", "comment_content" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare
  comment_record app_private.announcement_comments%rowtype;
  parent_record app_private.announcement_comments%rowtype;
  next_comment_count integer;
begin
  if parent_comment_id is not null then
    select * into parent_record from app_private.announcement_comments
    where id=backend_create_announcement_comment.parent_comment_id;
    if not found or parent_record.announcement_id<>backend_create_announcement_comment.announcement_id
      or parent_record.parent_comment_id is not null then raise exception 'invalid-parent-comment'; end if;
  end if;
  insert into app_private.announcement_comments(announcement_id,parent_comment_id,author_uid,content)
  values(backend_create_announcement_comment.announcement_id,
    backend_create_announcement_comment.parent_comment_id,actor_uid,comment_content)
  returning * into comment_record;
  select comment_count into next_comment_count from app_private.announcements
  where id=backend_create_announcement_comment.announcement_id;
  return jsonb_build_object(
    'comment',app_api.backend_announcement_comment_to_json(comment_record,'[]'::jsonb),
    'commentCount',coalesce(next_comment_count,0)
  );
end;
$$;

CREATE OR REPLACE FUNCTION "app_api"."backend_set_announcement_like"("announcement_id" "uuid", "actor_uid" "text", "liked" boolean) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare
  next_like_count integer;
begin
  if liked then
    insert into app_private.announcement_likes(announcement_id, uid)
    values (
      backend_set_announcement_like.announcement_id,
      backend_set_announcement_like.actor_uid
    )
    on conflict on constraint announcement_likes_pkey do nothing;
  else
    delete from app_private.announcement_likes
    where announcement_likes.announcement_id = backend_set_announcement_like.announcement_id
      and announcement_likes.uid = backend_set_announcement_like.actor_uid;
  end if;

  select announcements.like_count into next_like_count
  from app_private.announcements
  where announcements.id = backend_set_announcement_like.announcement_id;

  if not found then
    raise exception 'not-found';
  end if;

  return jsonb_build_object('liked', liked, 'likeCount', coalesce(next_like_count, 0));
end;
$$;

-- Deletion answers with what the events need and nothing else: the uploads a
-- deleted entry held are released by the cleanup triggers on the table, so the
-- lists of upload targets these functions used to assemble went unread.
drop function app_api.backend_delete_issue(uuid, text, boolean);
drop function app_api.backend_delete_issue_with_upload_targets(uuid, text, boolean, boolean);

create function app_api.backend_delete_issue(
  issue_id uuid,
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
  issue_record app_private.issues%rowtype;
  supporter_uids jsonb;
begin
  select * into issue_record
  from app_private.issues
  where id = backend_delete_issue.issue_id
  for update;
  if not found then
    raise exception 'not-found';
  end if;
  if not actor_can_manage
    and not (author_delete_enabled and issue_record.author_uid = backend_delete_issue.actor_uid)
  then
    raise exception 'permission-denied';
  end if;

  select coalesce(jsonb_agg(supporter.uid order by supporter.created_at), '[]'::jsonb)
  into supporter_uids
  from app_private.supports supporter
  where supporter.issue_id = issue_record.id;

  delete from app_private.issues where id = issue_record.id;

  return jsonb_build_object(
    'issueId', issue_record.id,
    'authorUid', issue_record.author_uid,
    'issueCategory', issue_record.category,
    'readAccess', issue_record.read_access,
    'status', issue_record.status,
    'title', issue_record.title,
    'supporterUids', supporter_uids
  );
end;
$$;

revoke all on function app_api.backend_delete_issue(uuid, text, boolean, boolean) from public;
grant execute on function app_api.backend_delete_issue(uuid, text, boolean, boolean) to novae_runtime;

create or replace function app_api.backend_delete_issue_comment(
  comment_id uuid,
  actor_uid text,
  actor_is_admin boolean
)
returns jsonb
language plpgsql
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
declare
  comment_record app_private.comments%rowtype;
begin
  select * into comment_record
  from app_private.comments
  where id = backend_delete_issue_comment.comment_id
  for update;
  if not found then
    raise exception 'not-found';
  end if;
  if comment_record.author_uid <> actor_uid and not actor_is_admin then
    raise exception 'permission-denied';
  end if;
  delete from app_private.comments where id = comment_record.id;
  return jsonb_build_object('issueId', comment_record.issue_id);
end;
$$;

create or replace function app_api.backend_delete_announcement_comment(
  comment_id uuid,
  actor_uid text,
  actor_is_admin boolean
)
returns jsonb
language plpgsql
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
declare
  comment_record app_private.announcement_comments%rowtype;
  next_comment_count integer;
begin
  select * into comment_record
  from app_private.announcement_comments
  where id = backend_delete_announcement_comment.comment_id
  for update;
  if not found then
    raise exception 'not-found';
  end if;
  if comment_record.author_uid <> actor_uid and not actor_is_admin then
    raise exception 'permission-denied';
  end if;
  delete from app_private.announcement_comments where id = comment_record.id;
  select comment_count into next_comment_count
  from app_private.announcements
  where id = comment_record.announcement_id;
  return jsonb_build_object(
    'announcementId', comment_record.announcement_id,
    'commentCount', coalesce(next_comment_count, 0)
  );
end;
$$;

drop function app_api.backend_delete_announcement(uuid);

create function app_api.backend_delete_announcement(announcement_id uuid)
returns void
language plpgsql
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
begin
  delete from app_private.announcements where id = backend_delete_announcement.announcement_id;
  if not found then
    raise exception 'not-found';
  end if;
end;
$$;

revoke all on function app_api.backend_delete_announcement(uuid) from public;
grant execute on function app_api.backend_delete_announcement(uuid) to novae_runtime;
