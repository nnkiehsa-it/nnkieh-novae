-- Migration: Add backend RPCs to delete category along with its issues/facilities and associated uploads

create or replace function app_api.backend_delete_issue_category(
  category_id text,
  actor_uid text
)
returns jsonb language plpgsql security definer set search_path = app_private, app_api, public as $$
declare
  is_default_cat boolean;
  issue_id_val uuid;
  supporter_uids jsonb;
begin
  -- 1. Check if the category is default
  select is_default into is_default_cat from app_private.issue_categories where issue_categories.id = backend_delete_issue_category.category_id;
  if is_default_cat then
    raise exception 'cannot-delete-default-category';
  end if;

  -- 2. Clean up issues and queue upload deletions
  for issue_id_val in select id from app_private.issues where issues.category = backend_delete_issue_category.category_id loop
    -- Queue deletions for issue uploads
    insert into app_private.deletion_jobs (target_type, target_id, cloudinary_public_id)
    select 'upload', id::text, cloudinary_public_id
    from app_private.uploads
    where (attached_target_type = 'issue' and attached_target_id = issue_id_val)
       or (attached_target_type = 'comment' and attached_target_id in (select id from app_private.comments where issue_id = issue_id_val));

    -- Delete uploads rows
    delete from app_private.uploads
    where (attached_target_type = 'issue' and attached_target_id = issue_id_val)
       or (attached_target_type = 'comment' and attached_target_id in (select id from app_private.comments where issue_id = issue_id_val));

    -- Collect supporter UIDs for outbox event before cascade deleting
    select coalesce(jsonb_agg(supporter.uid order by supporter.created_at), '[]'::jsonb)
    into supporter_uids
    from app_private.supports supporter
    where supporter.issue_id = issue_id_val;

    -- Write issue.deleted outbox event to notify outboxWorker to archive Notion page & clear notion_pages
    insert into app_private.outbox_events(event_type, target_type, target_id, actor_uid, payload)
    select
      'issue.deleted',
      'issue',
      issue_id_val::text,
      backend_delete_issue_category.actor_uid,
      jsonb_build_object(
        'author_uid', author_uid,
        'issue_category', category,
        'issue_id', id,
        'supporter_uids', supporter_uids,
        'title', title
      )
    from app_private.issues
    where id = issue_id_val;

    -- comments, supports, and notifications
    delete from app_private.comments where issue_id = issue_id_val;
    delete from app_private.supports where issue_id = issue_id_val;
    delete from app_private.notifications where target_type = 'issue' and target_id = issue_id_val::text;
    delete from app_private.issues where id = issue_id_val;
  end loop;

  -- 3. Delete category itself
  delete from app_private.issue_categories where issue_categories.id = backend_delete_issue_category.category_id;

  return jsonb_build_object('success', true);
end;
$$;

create or replace function app_api.backend_delete_facility_category(
  category_id text,
  actor_uid text
)
returns jsonb language plpgsql security definer set search_path = app_private, app_api, public as $$
declare
  is_default_cat boolean;
  facility_id_val uuid;
begin
  -- 1. Check if default
  select is_default into is_default_cat from app_private.facility_categories where facility_categories.id = backend_delete_facility_category.category_id;
  if is_default_cat then
    raise exception 'cannot-delete-default-category';
  end if;

  -- 2. Clean up facility reports and queue upload deletions
  for facility_id_val in select id from app_private.facility_reports where facility_reports.category_id = backend_delete_facility_category.category_id loop
    -- Queue deletions for facility report uploads
    insert into app_private.deletion_jobs (target_type, target_id, cloudinary_public_id)
    select 'upload', id::text, cloudinary_public_id
    from app_private.uploads
    where attached_target_type = 'facility_report' and attached_target_id = facility_id_val;

    -- Delete uploads rows
    delete from app_private.uploads
    where attached_target_type = 'facility_report' and attached_target_id = facility_id_val;

    -- Write facility.deleted outbox event to notify outboxWorker to archive Notion page & clear notion_pages
    insert into app_private.outbox_events(event_type, target_type, target_id, actor_uid, payload)
    select
      'facility.deleted',
      'facility',
      id::text,
      backend_delete_facility_category.actor_uid,
      jsonb_build_object(
        'author_uid', author_uid,
        'title', title
      )
    from app_private.facility_reports
    where id = facility_id_val;

    -- Delete notifications and facility report
    delete from app_private.notifications where target_type = 'facility' and target_id = facility_id_val::text;
    delete from app_private.facility_reports where id = facility_id_val;
  end loop;

  -- 3. Delete category itself
  delete from app_private.facility_categories where facility_categories.id = backend_delete_facility_category.category_id;

  return jsonb_build_object('success', true);
end;
$$;

-- Grant permissions
revoke all on function app_api.backend_delete_issue_category(text,text) from public, anon, authenticated;
grant execute on function app_api.backend_delete_issue_category(text,text) to service_role;

revoke all on function app_api.backend_delete_facility_category(text,text) from public, anon, authenticated;
grant execute on function app_api.backend_delete_facility_category(text,text) to service_role;
