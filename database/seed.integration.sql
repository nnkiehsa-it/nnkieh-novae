-- Backend integration fixtures. Initial setup intentionally remains pending so
-- setup idempotency and first-run behavior are exercised by the test suite.

insert into app_private.issue_categories (
  id, label, read_access, author_visible, support_enabled,
  support_goal, support_deadline_days, response_deadline_days,
  comments_enabled, is_active, is_default, sort_order, created_by
) values
  ('public-issues', '校園提案', 'reviewed-school', false, true, 50, 14, 7,
   true, true, true, 0, 'integration-seed'),
  ('rights-maintenance', '權益維護', 'owner-admin', true, false, null, null, 7,
   true, true, false, 1, 'integration-seed'),
  ('proposal-a', 'Proposal A', 'school', true, true, 5, 14, 7,
   true, true, false, 2, 'integration-seed'),
  ('proposal-b', 'Proposal B', 'school', true, true, 5, 14, 7,
   true, true, false, 3, 'integration-seed')
on conflict (id) do update set
  label = excluded.label,
  read_access = excluded.read_access,
  author_visible = excluded.author_visible,
  support_enabled = excluded.support_enabled,
  support_goal = excluded.support_goal,
  is_active = true,
  sort_order = excluded.sort_order;

insert into app_private.facility_categories
  (id, label, is_active, is_default, sort_order, created_by)
values
  ('general', '校園設備', true, true, 0, 'integration-seed'),
  ('facility-a', 'Facility A', true, false, 1, 'integration-seed'),
  ('facility-b', 'Facility B', true, false, 2, 'integration-seed')
on conflict (id) do update set
  label = excluded.label, is_active = true, sort_order = excluded.sort_order;

