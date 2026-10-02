-- Reconcile only the account being edited, within the scope mutation transaction.
-- A former administrator can receive a scope without waiting for their next login.
create function app_api.backend_reconcile_scope_target_admin(actor_uid text, target_uid text, admin_emails text[])
returns boolean language plpgsql security definer
set search_path to app_private, app_api, public
as $$
declare
  target_email text;
  configured_admin boolean;
  revoked_uid text;
begin
  if coalesce(btrim(actor_uid), '') = '' or coalesce(btrim(target_uid), '') = ''
    or coalesce(cardinality(admin_emails), 0) = 0 then raise exception 'validation-required'; end if;
  select lower(btrim(profile.email)) into target_email from app_private.user_profiles profile
    where profile.uid = backend_reconcile_scope_target_admin.target_uid for update;
  if not found then raise exception 'not-found'; end if;
  configured_admin := coalesce(target_email = any(admin_emails), false);
  if not configured_admin then
    delete from app_private.user_role_assignments assignment
      where assignment.uid = backend_reconcile_scope_target_admin.target_uid and role_code = 'platform-admin'
      returning uid into revoked_uid;
    if revoked_uid is not null then
      insert into app_private.role_assignment_audit(uid, role_code, operation, actor_uid)
        values (revoked_uid, 'platform-admin', 'revoke', backend_reconcile_scope_target_admin.actor_uid);
    end if;
  end if;
  return configured_admin;
end;
$$;
revoke all on function app_api.backend_reconcile_scope_target_admin(text,text,text[]) from public;
grant execute on function app_api.backend_reconcile_scope_target_admin(text,text,text[]) to novae_runtime;

create index user_profiles_normalized_email_idx on app_private.user_profiles (lower(btrim(email)));
