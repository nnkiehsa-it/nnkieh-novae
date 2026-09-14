-- Rebuild the Notion archive once with the complete schema and Chinese operation records.
insert into app_private.background_jobs (job_type, scope_id, payload, created_by)
select 'notion_reconcile', 'global', '{"schemaVersion":2}'::jsonb, 'migration:0035'
where not exists (
  select 1 from app_private.background_jobs
  where job_type = 'notion_reconcile' and status in ('pending', 'processing')
);
