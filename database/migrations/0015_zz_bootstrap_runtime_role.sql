-- 0016 grants the runtime boundary before deployment rotates its credentials.
-- A fresh PostgreSQL cluster has no such role, so create its least-capability
-- shell here; configure-database-runtime later enables login and sets password.

do $$
begin
  if not exists(select 1 from pg_roles where rolname = 'novae_runtime') then
    create role novae_runtime
      nologin
      nocreatedb
      nocreaterole
      noinherit;
  end if;
end;
$$;
