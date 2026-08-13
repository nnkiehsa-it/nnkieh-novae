drop function if exists app_api.backend_list_issue_comments(
  uuid,text,boolean,uuid,timestamptz,integer,text[],text[],text[]
);

create function app_api.backend_list_issue_comments(
  issue_id uuid,
  actor_uid text,
  actor_is_admin boolean,
  cursor_id uuid,
  cursor_created_at timestamptz,
  page_size integer,
  sort_name text,
  private_to_owner_categories text[],
  review_required_categories text[],
  public_comment_categories text[]
)
returns jsonb
language plpgsql
stable
security definer
set search_path = app_private, app_api, public
as $$
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
            'createdAtMs', floor(extract(epoch from created_at) * 1000)
          )
          from last_item
        )
        else null
      end
    )
  );
end;
$$;

drop function if exists app_api.backend_list_announcement_comments(
  uuid,uuid,timestamptz,integer
);

create function app_api.backend_list_announcement_comments(
  announcement_id uuid,
  cursor_id uuid,
  cursor_created_at timestamptz,
  page_size integer,
  sort_name text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = app_private, app_api, public
as $$
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
            'createdAtMs', floor(extract(epoch from created_at) * 1000)
          )
          from last_item
        )
        else null
      end
    )
  );
end;
$$;

revoke all on function app_api.backend_list_issue_comments(
  uuid,text,boolean,uuid,timestamptz,integer,text,text[],text[],text[]
) from public, anon, authenticated;
grant execute on function app_api.backend_list_issue_comments(
  uuid,text,boolean,uuid,timestamptz,integer,text,text[],text[],text[]
) to service_role;

revoke all on function app_api.backend_list_announcement_comments(
  uuid,uuid,timestamptz,integer,text
) from public, anon, authenticated;
grant execute on function app_api.backend_list_announcement_comments(
  uuid,uuid,timestamptz,integer,text
) to service_role;
