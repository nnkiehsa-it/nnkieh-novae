import assert from "node:assert/strict";
import test from "node:test";
import { listFiles, repoPath } from "../architecture/helpers.mjs";

test("primary product routes remain present", async () => {
  const paths = (await listFiles("src/app")).map(repoPath);
  for (const route of [
    "src/app/login/page.tsx",
    "src/app/(protected)/setup/page.tsx",
    "src/app/(protected)/issues/[filter]/page.tsx",
    "src/app/(protected)/issues/[filter]/new/page.tsx",
    "src/app/(protected)/issues/[filter]/[issueId]/page.tsx",
    "src/app/(protected)/facilities/page.tsx",
    "src/app/(protected)/facilities/new/page.tsx",
    "src/app/(protected)/facilities/[facilityId]/page.tsx",
    "src/app/(protected)/announcements/page.tsx",
    "src/app/(protected)/announcements/new/page.tsx",
    "src/app/(protected)/announcements/[announcementId]/page.tsx",
    "src/app/(protected)/notifications/page.tsx",
    "src/app/(protected)/settings/page.tsx",
    "src/app/(protected)/dashboard/page.tsx",
    "src/app/(protected)/admin/management/page.tsx",
  ]) assert.ok(paths.includes(route), `missing route ${route}`);
});
