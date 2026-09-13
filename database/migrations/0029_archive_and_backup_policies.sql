update app_private.runtime_settings set value=jsonb_set(value::jsonb,'{values}',
 value::jsonb->'values'||'{"notionArchiveDays":365,"backupIntervalHours":72,"backupCopies":2,"backupRetentionDays":7}'::jsonb)::text
where key='operations_settings';
create function app_private.archive_expired_notion_mapping() returns trigger
language plpgsql security definer set search_path to 'app_private','public' as $$
begin
 if exists(select 1 from app_private.background_jobs where job_type='deletion' and status='processing'
   and payload->>'notion_page_id'=old.notion_page_id) then return old; end if;
 if (old.target_type='issue' and exists(select 1 from app_private.issues where id::text=old.target_id))
   or (old.target_type='facility' and exists(select 1 from app_private.facility_reports where id::text=old.target_id))
   or (old.target_type='announcement' and exists(select 1 from app_private.announcements where id::text=old.target_id))
 then return old; end if;
 insert into app_private.background_jobs(job_type,scope_id,payload,created_by)
 values('deletion',old.target_id,jsonb_build_object('notion_page_id',old.notion_page_id,
   'target_type',old.target_type,'target_id',old.target_id),'notion-retention');
 return old;
end;
$$;
revoke all on function app_private.archive_expired_notion_mapping() from public;
create trigger archive_expired_notion_mapping before delete on app_private.notion_pages
for each row execute function app_private.archive_expired_notion_mapping();

