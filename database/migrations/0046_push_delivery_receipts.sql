-- Successful devices survive event-level retries. Receipts expire with their delivery;
-- store hashes, not a second copy of device credentials.
create table app_private.push_delivery_receipts (
  delivery_id uuid not null references app_private.event_deliveries(id) on delete cascade,
  token_hash text not null,
  primary key (delivery_id, token_hash)
);
revoke all on app_private.push_delivery_receipts from public;
grant select, insert, update, delete on app_private.push_delivery_receipts to novae_runtime;
