-- Values required by application logic in a brand-new installation.
-- User-created categories and content intentionally start empty.

insert into app_private.roles(code, label) values
  ('platform-admin', '平台管理員'),
  ('proposal-manager', '提案管理員'),
  ('announcement-manager', '公告管理員'),
  ('general-affairs', '設備管理員')
on conflict (code) do update set label = excluded.label;

insert into app_private.permissions(code, label) values
  ('proposal.manage', '管理提案'),
  ('announcement.manage', '管理公告'),
  ('facility.manage', '管理設備'),
  ('role.manage', '管理角色'),
  ('dashboard.view', '查看統計'),
  ('category.manage', '管理分類設定')
on conflict (code) do update set label = excluded.label;

insert into app_private.role_permissions(role_code, permission_code) values
  ('platform-admin', 'proposal.manage'),
  ('platform-admin', 'announcement.manage'),
  ('platform-admin', 'facility.manage'),
  ('platform-admin', 'role.manage'),
  ('platform-admin', 'dashboard.view'),
  ('platform-admin', 'category.manage'),
  ('proposal-manager', 'proposal.manage'),
  ('announcement-manager', 'announcement.manage'),
  ('general-affairs', 'facility.manage')
on conflict do nothing;

insert into app_private.system_setup(
  singleton,
  completed_at,
  completed_by,
  issues_enabled,
  facilities_enabled,
  announcement_comments_enabled
) values (true, null, null, true, true, true)
on conflict (singleton) do nothing;

insert into app_private.platform_counters(key, value) values
  ('issues_created', 0),
  ('issues_deleted', 0),
  ('comments_created', 0),
  ('comments_deleted', 0),
  ('supports_added', 0),
  ('supports_removed', 0),
  ('users_seen', 0)
on conflict (key) do nothing;

insert into app_private.content_versions(domain, version) values
  ('issues', 1),
  ('announcements', 1),
  ('facilities', 1)
on conflict (domain) do nothing;

revoke all on schema app_private from public;
revoke all on schema app_api from public;
revoke all on all tables in schema app_private from public;
revoke all on all sequences in schema app_private from public;
revoke all on all functions in schema app_private from public;
revoke all on all functions in schema app_api from public;
