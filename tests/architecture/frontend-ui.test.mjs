import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { read, listFiles } from "./helpers.mjs";

test("Next App Router preserves every primary product route", async () => {
  const files = await listFiles("src/app");
  const paths = files.map((file) => decodeURIComponent(file.pathname).replaceAll("\\", "/"));
  for (const route of [
    "/login/page.tsx",
    "/setup/page.tsx",
    "/issues/[filter]/page.tsx",
    "/issues/[filter]/new/page.tsx",
    "/issues/[filter]/[issueId]/page.tsx",
    "/facilities/page.tsx",
    "/facilities/new/page.tsx",
    "/facilities/[facilityId]/page.tsx",
    "/announcements/page.tsx",
    "/announcements/new/page.tsx",
    "/announcements/[announcementId]/page.tsx",
    "/notifications/page.tsx",
    "/settings/page.tsx",
    "/dashboard/page.tsx",
    "/admin/management/page.tsx",
  ]) assert.ok(paths.some((path) => path.endsWith(route)), `missing route ${route}`);
});

test("shared shell owns desktop, compact, and mobile navigation", async () => {
  const shell = await read("src/components/app-shell.tsx");
  const nav = await read("src/components/liquid-nav.tsx");
  assert.match(shell, /hidden[^\n]*md:flex/u);
  assert.match(shell, /md:hidden/u);
  assert.match(shell, /safe-bottom|var\(--safe-bottom\)/u);
  assert.match(nav, /aria-current/u);
  assert.match(nav, /bg-secondary text-foreground/u);
  assert.doesNotMatch(nav, /liquid-gooey|Liquid\.Item/u);
  assert.match(nav, /ui\.nav\.primary/u);
});

test("route and component presentation delegates service flows to hooks", async () => {
  const files = [
    ...(await listFiles("src/app")),
    ...(await listFiles("src/components")),
  ].filter((file) => file.pathname.endsWith(".tsx"));
  const violations = [];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    if (/from\s+["']@\/services\//u.test(source)) violations.push(file.pathname);
  }
  assert.deepEqual(violations, []);
});

test("domain lists, details, discussion, and composers use shared components", async () => {
  const issueList = await read("src/app/(protected)/issues/[filter]/page.tsx");
  const facilityList = await read("src/app/(protected)/facilities/page.tsx");
  const announcementList = await read("src/app/(protected)/announcements/page.tsx");
  const issueDetail = await read("src/app/(protected)/issues/[filter]/[issueId]/page.tsx");
  const facilityDetail = await read("src/app/(protected)/facilities/[facilityId]/page.tsx");
  const announcementDetail = await read("src/app/(protected)/announcements/[announcementId]/page.tsx");
  assert.match(issueList, /IssueCard/u);
  assert.match(facilityList, /FacilityCard/u);
  assert.match(announcementList, /AnnouncementCard/u);
  assert.match(issueDetail, /IssueDetailContent/u);
  for (const source of [issueDetail, announcementDetail]) assert.match(source, /Discussion/u);
  assert.match(facilityDetail, /FacilityStatusDialog/u);
  for (const path of [
    "src/app/(protected)/issues/[filter]/new/page.tsx",
    "src/app/(protected)/facilities/new/page.tsx",
    "src/app/(protected)/announcements/new/page.tsx",
  ]) assert.match(await read(path), /ComposerField/u);
});

test("design tokens and motion recipes are centralized and capability-aware", async () => {
  const globals = await read("src/app/globals.css");
  const motion = await read("src/styles/motion.css");
  for (const token of ["--background", "--surface-stage", "--border", "--radius", "--shadow-control", "--shadow-card", "--shadow-floating"]) assert.ok(globals.includes(token));
  for (const recipe of ["t-route-enter", "t-panel-reveal", "t-stagger-item", "t-digit", "t-dialog", "t-dropdown", "t-success-check", "t-shimmer"]) assert.ok(motion.includes(recipe));
  assert.match(motion, /@media \(prefers-reduced-motion: reduce\)/u);
  assert.match(motion, /@media \(hover: hover\) and \(pointer: fine\)/u);
  assert.doesNotMatch(`${globals}\n${motion}`, /transition-all/u);
});

test("the frontend contains no parallel Vue implementation", async () => {
  const files = await listFiles("src");
  assert.equal(files.some((file) => file.pathname.endsWith(".vue")), false);
  const source = (await Promise.all(files.filter((file) => /\.(?:ts|tsx|css)$/u.test(file.pathname)).map((file) => readFile(file, "utf8")))).join("\n");
  assert.doesNotMatch(source, /@vue\/|vue-tsc|reka-ui/u);
});
