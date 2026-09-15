-- Caching an avatar is now asked for once a day per browser, not once a visit.
--
-- The signed-in account's avatar was cached on every session start, and caching
-- one is a write with a daily allowance of ten. A handful of reloads spent the
-- whole allowance and every later visit was refused. The browser keeps the
-- answer for the day the worker would have answered from its own copy anyway,
-- so what is left is one request a day per browser; the allowance is raised to
-- thirty so that several devices, or a sign-in from a private window, still fit
-- inside it.

update app_private.runtime_settings
set value = jsonb_set(
  value::jsonb,
  '{values}',
  value::jsonb->'values' || '{"avatarCacheDaily":30}'::jsonb
)::text,
    updated_at = now()
where key = 'operations_settings';
