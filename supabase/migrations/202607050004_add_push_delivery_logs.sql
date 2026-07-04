create table if not exists app_private.push_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  token_uid text,
  notification_type text not null,
  target_type text not null,
  target_id text not null,
  status text not null check (status in ('sent', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table app_private.push_delivery_logs enable row level security;

create index if not exists push_delivery_logs_status_updated_idx
  on app_private.push_delivery_logs (status, updated_at desc);

create index if not exists push_delivery_logs_target_idx
  on app_private.push_delivery_logs (target_type, target_id, created_at desc);
