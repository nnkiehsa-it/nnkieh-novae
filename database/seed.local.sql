-- Deterministic local-only records for integration and browser tests.

insert into app_private.issue_categories (
  id, label, read_access, author_visible, support_enabled,
  support_goal, support_deadline_days, response_deadline_days,
  comments_enabled, is_active, is_default, sort_order, created_by
) values
  ('public-issues', '校園提案', 'reviewed-school', false, true, 50, 14, 7,
   true, true, true, 0, 'local-seed'),
  ('rights-maintenance', '權益維護', 'owner-admin', true, false, null, null, 7,
   true, true, false, 1, 'local-seed'),
  ('proposal-a', 'Proposal A', 'school', true, true, 5, 14, 7,
   true, true, false, 2, 'local-seed'),
  ('proposal-b', 'Proposal B', 'school', true, true, 5, 14, 7,
   true, true, false, 3, 'local-seed')
on conflict (id) do update set
  label = excluded.label,
  is_active = true,
  sort_order = excluded.sort_order;

insert into app_private.facility_categories
  (id, label, is_active, is_default, sort_order, created_by)
values
  ('general', '校園設備', true, true, 0, 'local-seed'),
  ('facility-a', 'Facility A', true, false, 1, 'local-seed'),
  ('facility-b', 'Facility B', true, false, 2, 'local-seed')
on conflict (id) do update set
  label = excluded.label, is_active = true, sort_order = excluded.sort_order;

update app_private.system_setup
set completed_at = now(), completed_by = 'local-seed', updated_at = now()
where singleton = true;

insert into app_private.user_profiles (uid, display_name) values
  ('novae-e2e-admin', '本地管理員'),
  ('novae-e2e-ordinary', '本地成員')
on conflict (uid) do update set display_name = excluded.display_name;

insert into app_private.user_roles (uid, role) values
  ('novae-e2e-admin', 'admin'),
  ('novae-e2e-ordinary', 'user')
on conflict (uid) do update set role = excluded.role;

insert into app_private.user_role_assignments (uid, role_code, granted_by)
values ('novae-e2e-admin', 'platform-admin', 'local-seed')
on conflict (uid, role_code) do nothing;

insert into app_private.issues (
  id, author_uid, title, content, status, category,
  support_enabled, support_goal
) values (
  '00000000-0000-4000-8000-000000000001', 'novae-e2e-ordinary',
  '圖書館延長開放時間', '希望考試期間延長圖書館開放時間，方便同學安排自習。',
  'pending', 'public-issues', true, 5
)
on conflict (id) do update set
  title = excluded.title, content = excluded.content, status = excluded.status;

insert into app_private.facility_reports (
  id, author_uid, title, title_search, location, content, status, category_id
) values (
  '00000000-0000-4000-8000-000000000002', 'novae-e2e-ordinary',
  '教學大樓飲水機故障', '教學大樓飲水機故障', '教學大樓一樓',
  '飲水機無法出水，請協助安排檢修。', 'pending', 'general'
)
on conflict (id) do update set
  title = excluded.title, content = excluded.content, status = excluded.status;

insert into app_private.announcements (id, author_uid, title, content)
values (
  '00000000-0000-4000-8000-000000000003', 'novae-e2e-admin',
  '歡迎使用 Novae', '這是本地開發環境的公告，用來檢查公告列表與留言流程。'
)
on conflict (id) do update set title = excluded.title, content = excluded.content;
