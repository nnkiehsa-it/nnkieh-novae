import assert from "node:assert/strict";
import test from "node:test";
import { read } from "./helpers.mjs";

test("content feeds retain bounded cursor pagination", async () => {
  const pageSize = await read("src/lib/page-size.ts");
  const issues = await read("src/services/issues-read-pages.ts");
  const facilities = await read("src/services/facilities.ts");
  const announcements = await read("src/services/announcements.ts");
  const comments = await read("src/services/issues-read-comments.ts");
  assert.match(pageSize, /CONTENT_FEED_PAGE_SIZE\s*=\s*30/u);
  for (const source of [issues, facilities, announcements, comments]) {
    assert.match(source, /cursor/u);
    assert.match(source, /hasMore|has_more/u);
  }
});

test("content writes validate uploads before backend mutations", async () => {
  const source = await read("src/hooks/use-entry-composer.ts");
  assert.match(source, /uploadAndAppend/u);
  assert.match(source, /deleteUploadedImages/u);
  assert.ok(source.indexOf("await images.uploadAndAppend") < source.indexOf("await create"));
  for (const creator of ["createIssue", "createFacility", "createAnnouncement"])
    assert.match(source, new RegExp(creator, "u"));
});

test("frontend data access remains behind services and backend actions", async () => {
  const action = await read("src/services/backend-action.ts");
  const issues = await read("src/services/issues-core.ts");
  const facilities = await read("src/services/facilities.ts");
  const announcements = await read("src/services/announcements.ts");
  assert.match(action, /invokeBackendAction/u);
  for (const source of [issues, facilities, announcements]) assert.doesNotMatch(source, /\.from\(/u);
});

test("manager access remains category scoped", async () => {
  const access = await read("src/services/access.ts");
  const policy = await read("src/lib/session-access.ts");
  const management = await read("src/components/admin/access-management.tsx");
  const flow = await read("src/hooks/use-access-management.ts");
  assert.match(access, /categoryId/u);
  assert.match(access, /setUserAccessScope/u);
  assert.match(policy, /managedIssueCategoryIds/u);
  assert.match(policy, /managedFacilityCategoryIds/u);
  assert.match(management, /ui\.access\.selectDescription/u);
  assert.match(flow, /setUserAccessScope/u);
});

test("category setup and later management use atomic service boundaries", async () => {
  const service = await read("src/services/categories.ts");
  const setup = await read("src/app/(protected)/setup/page.tsx");
  const management = await read("src/components/admin/category-management.tsx");
  const setupFlow = await read("src/hooks/use-initial-setup.ts");
  const managementFlow = await read("src/hooks/use-category-management.ts");
  assert.match(service, /completeInitialSetup/u);
  assert.match(service, /saveCategoryManagement/u);
  assert.match(setup, /CategorySetupPanel/u);
  assert.match(setupFlow, /completeInitialSetup/u);
  assert.match(management, /useCategoryManagement/u);
  assert.match(managementFlow, /saveCategoryManagement/u);
});

test("database retention and cascade contracts remain present", async () => {
  const retention = await read("config/data-retention.config.json");
  const migration = await read("database/migrations/0001_baseline.sql");
  const deletion = [
    await read("cloudflare/src/backend/actions/issue-delete.ts"),
    await read("cloudflare/src/backend/actions/facilities.ts"),
    await read("cloudflare/src/backend/actions/announcement-write.ts"),
  ].join("\n");
  assert.match(retention, /outboxCompletedDays/u);
  assert.match(migration, /create trigger/iu);
  assert.match(deletion, /deleteIssue|deleteFacility|deleteAnnouncement/u);
});
