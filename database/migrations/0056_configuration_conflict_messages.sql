-- Stale policy drafts are configuration conflicts, not requests still running.
create or replace function app_api.save_operation_policies(actor_uid text, expected_revision integer, policy_values jsonb, reason text)
returns jsonb language plpgsql security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
declare previous jsonb; result jsonb;
begin
  if not exists(select 1 from app_private.user_role_assignments where uid=actor_uid and role_code='platform-admin')
  then raise exception 'permission-denied'; end if;
  if length(btrim(reason)) < 1 or length(reason) > 500 or jsonb_typeof(policy_values) <> 'object'
  then raise exception 'validation-invalid'; end if;
  select value::jsonb into previous from app_private.runtime_settings where key='operations_settings' for update;
  if (previous->>'revision')::integer <> expected_revision then raise exception 'configuration-changed'; end if;
  result := jsonb_build_object('revision', expected_revision+1, 'values', policy_values);
  update app_private.runtime_settings set value=result::text, updated_at=now() where key='operations_settings';
  insert into app_private.operation_policy_history(actor_uid,revision,before_value,after_value,reason)
  values(actor_uid,expected_revision+1,previous->'values',policy_values,btrim(reason));
  return result;
end;
$$;
revoke all on function app_api.save_operation_policies(text,integer,jsonb,text) from public;
grant execute on function app_api.save_operation_policies(text,integer,jsonb,text) to novae_runtime;
