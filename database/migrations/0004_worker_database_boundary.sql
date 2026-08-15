-- The browser never connects to PostgreSQL. Cloudflare Worker authorization is
-- the only application access boundary, so legacy provider RLS is disabled and
-- a separately provisioned runtime role receives explicit object privileges.

do $$
declare
  relation record;
begin
  for relation in
    select schemaname, tablename
    from pg_tables
    where schemaname = 'app_private'
  loop
    execute format(
      'alter table %I.%I disable row level security',
      relation.schemaname,
      relation.tablename
    );
  end loop;
end;
$$;

revoke create on schema public from public;
revoke all on schema app_private from public;
revoke all on schema app_api from public;
revoke all on all tables in schema app_private from public;
revoke all on all sequences in schema app_private from public;
revoke all on all functions in schema app_private from public;
revoke all on all functions in schema app_api from public;

