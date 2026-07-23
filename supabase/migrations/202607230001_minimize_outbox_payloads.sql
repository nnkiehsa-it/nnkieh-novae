-- Keep transient outbox rows small. Workers resolve full text from source tables
-- only when the event is actually processed.

create or replace function app_private.queue_issue_change()
returns trigger language plpgsql security definer
set search_path = app_private, public as $$
begin
  if tg_op = 'INSERT' then
    insert into app_private.outbox_events(event_type,target_type,target_id,actor_uid,payload)
    values('issue.created','issue',new.id::text,new.author_uid,jsonb_build_object(
      'author_uid',new.author_uid,'category',new.category,'issue_id',new.id,
      'status',new.status,'support_count',new.support_count,
      'support_goal',new.support_goal,'title',new.title
    ));
  elsif old.status is distinct from new.status then
    insert into app_private.outbox_events(event_type,target_type,target_id,actor_uid,payload)
    values('issue.status_changed','issue',new.id::text,coalesce(new.last_actor_uid,'system'),jsonb_build_object(
      'author_uid',new.author_uid,'new_status',new.status,'old_status',old.status,
      'reason',new.review_rejection_reason,'support_count',new.support_count,
      'support_goal',new.support_goal,'title',new.title,'issue_category',new.category
    ));
  end if;
  return new;
end;
$$;

create or replace function app_private.queue_comment_created()
returns trigger language plpgsql security definer
set search_path = app_private, public as $$
declare issue_record app_private.issues%rowtype; parent_author_uid text;
begin
  select * into issue_record from app_private.issues where id = new.issue_id;
  if new.parent_comment_id is not null then
    select author_uid into parent_author_uid
    from app_private.comments where id = new.parent_comment_id;
  end if;
  insert into app_private.outbox_events(event_type,target_type,target_id,actor_uid,payload)
  values('issue.comment_created','issue',new.issue_id::text,new.author_uid,jsonb_build_object(
    'author_uid',new.author_uid,'comment_id',new.id,
    'issue_author_uid',issue_record.author_uid,'issue_category',issue_record.category,
    'issue_id',new.issue_id,'parent_author_uid',parent_author_uid,
    'parent_comment_id',new.parent_comment_id,'title',issue_record.title
  ));
  return new;
end;
$$;

create or replace function app_private.queue_announcement_change()
returns trigger language plpgsql security definer
set search_path = app_private, public as $$
declare row_record app_private.announcements%rowtype;
begin
  if tg_op = 'DELETE' then row_record := old; else row_record := new; end if;
  insert into app_private.outbox_events(event_type,target_type,target_id,actor_uid,payload)
  values(case when tg_op = 'INSERT' then 'announcement.created'
      when tg_op = 'UPDATE' then 'announcement.updated' else 'announcement.deleted' end,
    'announcement',row_record.id::text,row_record.author_uid,jsonb_build_object(
      'announcement_id',row_record.id,'author_uid',row_record.author_uid,'title',row_record.title
    ));
  return row_record;
end;
$$;

create or replace function app_private.queue_announcement_comment_created()
returns trigger language plpgsql security definer
set search_path = app_private, public as $$
declare announcement_record app_private.announcements%rowtype; parent_author_uid text;
begin
  select * into announcement_record
  from app_private.announcements where id = new.announcement_id;
  if new.parent_comment_id is not null then
    select author_uid into parent_author_uid
    from app_private.announcement_comments where id = new.parent_comment_id;
  end if;
  insert into app_private.outbox_events(event_type,target_type,target_id,actor_uid,payload)
  values('announcement.comment_created','announcement',new.announcement_id::text,new.author_uid,jsonb_build_object(
    'announcement_author_uid',announcement_record.author_uid,
    'announcement_id',new.announcement_id,'author_uid',new.author_uid,
    'comment_id',new.id,'parent_author_uid',parent_author_uid,
    'parent_comment_id',new.parent_comment_id,'title',announcement_record.title
  ));
  return new;
end;
$$;

update app_private.outbox_events
set payload = payload - 'content'
where status in ('pending', 'processing') and payload ? 'content';
