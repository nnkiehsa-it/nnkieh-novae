alter table app_private.user_profiles
  add column if not exists avatar_public_id text,
  add column if not exists avatar_source_url text,
  add column if not exists avatar_hash text,
  add column if not exists avatar_version integer not null default 0;

create index if not exists user_profiles_avatar_public_id_idx
  on app_private.user_profiles (avatar_public_id)
  where avatar_public_id is not null;
