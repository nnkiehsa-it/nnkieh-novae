-- Failed-job logs may expire; unresolved external asset identifiers may not.
create table app_private.external_cleanup_backlog(
  job_id uuid primary key,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
grant select,insert,delete on app_private.external_cleanup_backlog to novae_runtime;
create function app_private.preserve_external_cleanup() returns trigger
language plpgsql security definer set search_path to 'app_private','public'
as $$
begin
  if old.job_type='deletion' and old.status not in ('completed','superseded') then
    insert into app_private.external_cleanup_backlog(job_id,payload)
    values(old.id,jsonb_strip_nulls(jsonb_build_object(
      'cloudinary_public_id',old.payload->'cloudinary_public_id',
      'notion_page_id',old.payload->'notion_page_id',
      'target_type',old.payload->'target_type','target_id',old.payload->'target_id')))
    on conflict(job_id) do nothing;
  end if;
  return old;
end;
$$;
revoke all on function app_private.preserve_external_cleanup() from public;
create trigger preserve_external_cleanup before delete on app_private.background_jobs
for each row execute function app_private.preserve_external_cleanup();
