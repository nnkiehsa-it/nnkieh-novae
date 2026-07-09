create or replace function app_private.queue_announcement_comment_created()
returns trigger
language plpgsql
security definer
set search_path = app_private, public
as $$
declare
  announcement_record app_private.announcements%rowtype;
  parent_author_uid text;
begin
  select * into announcement_record
  from app_private.announcements
  where id = new.announcement_id;

  if new.parent_comment_id is not null then
    select author_uid into parent_author_uid
    from app_private.announcement_comments
    where id = new.parent_comment_id;
  end if;

  insert into app_private.outbox_events(event_type,target_type,target_id,actor_uid,payload)
  values (
    'announcement.comment_created', 'announcement', new.announcement_id::text, new.author_uid,
    jsonb_build_object(
      'announcement_author_uid', announcement_record.author_uid,
      'announcement_id', new.announcement_id,
      'author_name', new.author_name,
      'author_photo_url', new.author_photo_url,
      'author_uid', new.author_uid,
      'content', new.content,
      'parent_author_uid', parent_author_uid,
      'parent_comment_id', new.parent_comment_id,
      'title', announcement_record.title
    )
  );
  return new;
end;
$$;
