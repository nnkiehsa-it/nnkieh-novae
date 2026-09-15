alter table app_private.user_restrictions
  drop constraint if exists user_restrictions_uid_fkey,
  drop constraint if exists user_restrictions_pkey;

alter table app_private.user_restrictions
  add column target_type text not null default 'uid',
  add column preset text not null default 'read_only';

alter table app_private.user_restrictions
  add constraint user_restrictions_pkey primary key (target_type, uid),
  add constraint user_restrictions_target_type_check
    check (target_type in ('uid', 'email_prefix')),
  add constraint user_restrictions_preset_check
    check (preset in ('read_only', 'reaction_only', 'blocked')),
  add constraint user_restrictions_target_check
    check (
      (target_type = 'uid' and char_length(uid) between 1 and 128)
      or (
        target_type = 'email_prefix'
        and uid = lower(btrim(uid))
        and char_length(uid) between 1 and 64
        and uid ~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+$'
      )
    );

create index user_restrictions_active_prefix_idx
  on app_private.user_restrictions (char_length(uid) desc, uid)
  where target_type = 'email_prefix';

revoke all on app_private.user_restrictions from public;
grant select, insert, update, delete on app_private.user_restrictions to novae_runtime;

drop function app_api.backend_set_user_restriction(text, text, text, text);
