insert into app_private.runtime_settings(key,value)
values ('operations_settings', '{"revision":1,"values":{"jobBatchSize":10,"policyBatchSize":100,"clientWriteCooldownMs":500,"requestTimeoutMs":15000,"readTimeoutMs":5000,"longTimeoutMs":30000,"retryAttempts":3,"retryAfterMaxMs":10000,"realtimeIdleMinutes":30,"realtimeTicketSeconds":45,"titleLength":30,"contentLength":1000,"commentLength":70,"resultLength":2000,"locationLength":120,"searchLength":120,"errorRetentionDays":14,"metricsRetentionDays":30,"issueCreateDaily":10,"facilityCreateDaily":10,"announcementCreateDaily":20,"commentCreateHourly":60,"imageUploadDaily":50,"loginSyncHourly":20,"avatarCacheDaily":10,"supportToggleHourly":120,"facilityAffectedToggleHourly":120,"facilityStatusUpdateHourly":60,"announcementLikeHourly":120,"pushTokenWriteHourly":30,"preferenceWriteHourly":60,"moderationWriteHourly":120,"roleWriteHourly":120,"destructiveWriteHourly":30,"backendHealthcheckMinute":12,"backendHealthcheckSecond":2,"workerRunMinute":30,"workerRunSecond":2}}');

create table app_private.operation_policy_history (
  id bigint generated always as identity primary key,
  actor_uid text not null,
  revision integer not null unique,
  before_value jsonb not null,
  after_value jsonb not null,
  reason text not null,
  created_at timestamptz not null default now()
);
grant select, insert on app_private.operation_policy_history to novae_runtime;
grant usage, select on sequence app_private.operation_policy_history_id_seq to novae_runtime;

create function app_api.save_operation_policies(actor_uid text, expected_revision integer, policy_values jsonb, reason text)
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
  if (previous->>'revision')::integer <> expected_revision then raise exception 'request-in-progress'; end if;
  result := jsonb_build_object('revision', expected_revision+1, 'values', policy_values);
  update app_private.runtime_settings set value=result::text, updated_at=now() where key='operations_settings';
  insert into app_private.operation_policy_history(actor_uid,revision,before_value,after_value,reason)
  values(actor_uid,expected_revision+1,previous->'values',policy_values,btrim(reason));
  return result;
end;
$$;
revoke all on function app_api.save_operation_policies(text,integer,jsonb,text) from public;
grant execute on function app_api.save_operation_policies(text,integer,jsonb,text) to novae_runtime;

create table app_private.operational_errors (
  bucket date not null default current_date,
  action text not null,
  code text not null,
  status integer not null,
  count bigint not null default 1,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  operation_id uuid,
  failure_id uuid,
  primary key(bucket,action,code,status)
);
create table app_private.operational_metrics (
  bucket date primary key default current_date,
  database_bytes bigint not null,
  measured_at timestamptz not null default now()
);
grant select, insert, update, delete on app_private.operational_errors, app_private.operational_metrics to novae_runtime;
