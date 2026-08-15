create or replace function app_api.reject_expired_support_issues()
returns integer
language sql
security definer
set search_path = app_private, app_api, pg_catalog
as $$
  select app_private.reject_expired_support_issues();
$$;

revoke all on function app_api.reject_expired_support_issues() from public;

