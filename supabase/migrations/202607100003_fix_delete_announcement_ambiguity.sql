-- Fix column ambiguity in backend_delete_announcement function.
create or replace function app_api.backend_delete_announcement(
  announcement_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = app_private, app_api, public
as $$
declare
  upload_targets jsonb;
begin
  select jsonb_build_array(jsonb_build_object('id', backend_delete_announcement.announcement_id, 'type', 'announcement'))
    || coalesce(jsonb_agg(jsonb_build_object('id', id, 'type', 'announcement_comment')), '[]'::jsonb)
  into upload_targets
  from app_private.announcement_comments
  where announcement_comments.announcement_id = backend_delete_announcement.announcement_id;

  delete from app_private.announcements
  where id = backend_delete_announcement.announcement_id;

  return jsonb_build_object(
    'success', true,
    'upload_targets', coalesce(upload_targets, jsonb_build_array(jsonb_build_object('id', backend_delete_announcement.announcement_id, 'type', 'announcement')))
  );
end;
$$;

revoke all on function app_api.backend_delete_announcement(uuid) from public, anon, authenticated;
grant execute on function app_api.backend_delete_announcement(uuid) to service_role;
