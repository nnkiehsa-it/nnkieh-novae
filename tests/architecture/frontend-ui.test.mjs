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
  assert.match(shell, /getDefaultIssueRouteFilter/u);
  assert.match(shell, /activePathPrefix: "\/issues"/u);
  assert.match(shell, /href: issueHref/u);
  assert.match(nav, /item\.activePathPrefix/u);
  assert.match(nav, /ui\.nav\.primary/u);
});

test("all interface logos use the square shared brand primitive", async () => {
  const brand = await read("src/components/ui/brand.tsx");
  const layout = await read("src/app/layout.tsx");
  const login = await read("src/app/login/page.tsx");
  const startup = await read("src/components/protected-app.tsx");
  assert.match(brand, /aspect-square/u);
  assert.match(brand, /object-contain/u);
  assert.match(login, /<BrandLockup/u);
  assert.doesNotMatch(login, /LockKeyhole/u);
  assert.doesNotMatch(login, /liquid-gooey|<Liquid|Secure campus participation platform/u);
  assert.match(layout, /apple-touch-icon-180x180\.png/u);
  assert.match(startup, /markClassName="size-24 rounded-3xl p-4"/u);
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

test("authenticated shell preloads route bundles without loading content data", async () => {
  const shell = await read("src/components/app-shell.tsx");
  const preload = await read("src/hooks/use-route-preload.ts");
  assert.match(shell, /useRoutePreload\(\)/u);
  assert.match(preload, /primaryRoutes\.forEach\(\(route\) => router\.prefetch\(route\)\)/u);
  assert.ok(
    preload.indexOf("const primaryRoutes") <
      preload.indexOf("if (!categories.loaded"),
    "static primary routes should warm before category hydration",
  );
  assert.match(preload, /"\/notifications"[\s\S]*"\/settings"/u);
  assert.match(preload, /requestIdleCallback/u);
  assert.match(preload, /deferredRoutes/u);
  assert.doesNotMatch(preload, /@\/services|(?:^|[^\w])fetch\(|supabase|backendAction/u);
  for (const path of [
    "src/app/(protected)/notifications/loading.tsx",
    "src/app/(protected)/settings/loading.tsx",
  ]) {
    assert.match(await read(path), /PageHeader/u);
  }
});

test("detail back actions restore compatible list history with a canonical fallback", async () => {
  const navigationMemory = await read("src/lib/navigation-memory.ts");
  const issueDetail = await read("src/hooks/use-issue-detail.ts");
  const facilityDetail = await read("src/hooks/use-facility-detail.ts");
  const announcementDetail = await read("src/app/(protected)/announcements/[announcementId]/page.tsx");
  assert.match(navigationMemory, /router\.back\(\)/u);
  assert.match(navigationMemory, /router\.push\(fallback\)/u);
  for (const source of [issueDetail, facilityDetail, announcementDetail])
    assert.match(source, /returnToPreviousRoute/u);
});

test("primary data views restore bounded user-scoped memory before refresh", async () => {
  const memory = await read("src/lib/view-memory-cache.ts");
  assert.match(memory, /MAX_VIEW_MEMORY_ENTRIES/u);
  assert.match(memory, /VIEW_MEMORY_TTL_MS/u);
  assert.match(await read("src/hooks/use-session.tsx"), /clearViewMemoryScope/u);
  for (const path of [
    "src/hooks/use-issue-feed.ts",
    "src/hooks/use-facility-feed.ts",
    "src/hooks/use-announcement-feed.ts",
    "src/hooks/use-notifications-page.ts",
    "src/hooks/use-platform-dashboard.ts",
    "src/hooks/use-push-notifications.ts",
  ]) {
    const source = await read(path);
    assert.match(source, /getViewMemory/u);
    assert.match(source, /setViewMemory/u);
  }
});

test("list status controls use the full action row and stay right aligned", async () => {
  const issueList = await read("src/app/(protected)/issues/[filter]/page.tsx");
  const facilityList = await read("src/app/(protected)/facilities/page.tsx");
  assert.match(issueList, /flex w-full items-center gap-2[\s\S]*<Button asChild>[\s\S]*className="ml-auto"/u);
  assert.match(facilityList, /flex w-full items-center gap-2[\s\S]*<Button asChild>[\s\S]*className="ml-auto"/u);
  assert.equal((issueList.match(/<LiquidTabs/g) ?? []).length, 1);
  assert.equal((facilityList.match(/<LiquidTabs/g) ?? []).length, 1);
});

test("discussion uses one card surface and a fixed reply-aware composer", async () => {
  const discussion = await read("src/components/discussion.tsx");
  const thread = await read("src/components/comments/comment-thread.tsx");
  const globals = await read("src/app/globals.css");
  const zhUi = await read("src/i18n/messages/zh-TW/ui.ts");
  assert.match(discussion, /<Card className="gap-0 overflow-hidden py-0">/u);
  assert.match(discussion, /className="discussion-composer-dock"/u);
  assert.match(discussion, /characters\.slice\(0, 20\)/u);
  assert.match(discussion, /ui\.discussion\.replying/u);
  assert.match(thread, /onReply\(reply, comment\.id\)/u);
  assert.match(globals, /\.discussion-composer-dock \{[\s\S]*position: fixed/u);
  assert.doesNotMatch(discussion, /ui\.discussion\.empty/u);
  assert.match(zhUi, /'ui\.discussion\.replying': '正在回覆 \{name\}'/u);
  assert.match(zhUi, /'ui\.discussion\.commentPlaceholder': '新增留言…'/u);
});

test("proposal ownership and moderation remain separate capabilities", async () => {
  const actions = await read("src/components/issues/issue-detail-actions.tsx");
  const detail = await read("src/hooks/use-issue-detail.ts");
  const issueShared = await read("supabase/functions/backendAction/issue-shared.ts");
  assert.match(actions, /issue\.isOwnIssue \|\| canManage/u);
  assert.match(actions, /\{canManage \? \(/u);
  assert.doesNotMatch(actions, /issue\.canManageIssue/u);
  assert.match(detail, /session\.canManageIssueCategory\(currentIssue\.category\)/u);
  assert.match(issueShared, /const canManageIssue = actorCanManageCategory;/u);
});

test("proposal detail reaction and count match centered announcement layout", async () => {
  const actions = await read("src/components/issues/issue-detail-actions.tsx");
  const animatedNumber = await read("src/components/motion/animated-number.tsx");
  assert.match(actions, /whitespace-nowrap text-sm font-semibold tabular-nums/u);
  assert.match(actions, /<div className="flex justify-center">[\s\S]*<LikeActionButton/u);
  assert.match(animatedNumber, /shrink-0 whitespace-nowrap overflow-hidden/u);
});

test("HarmonyOS subset preserves the weights used before the frontend rewrite", async () => {
  const generator = await read("scripts/generate-harmonyos-subset.mjs");
  for (const weight of [400, 500, 600, 700]) {
    assert.match(generator, new RegExp(`weight: ${weight}`, "u"));
  }
});

test("list action bars scroll normally and route navigation animates only the committed page", async () => {
  const issueList = await read("src/app/(protected)/issues/[filter]/page.tsx");
  const facilityList = await read("src/app/(protected)/facilities/page.tsx");
  const shell = await read("src/components/app-shell.tsx");
  const motion = await read("src/styles/motion.css");
  for (const source of [issueList, facilityList]) {
    assert.doesNotMatch(source, /sticky top-\[var\(--safe-top\)\]/u);
  }
  assert.match(shell, /app-top-blur/u);
  assert.match(shell, /window\.scrollY > 8/u);
  assert.match(shell, /data-visible=\{scrolled\}/u);
  assert.match(shell, /app-mobile-nav/u);
  assert.match(shell, /<RouteTransition key=\{pathname\} pathname=\{pathname\}>/u);
  assert.match(shell, /consumeRouteDirection\(pathname\)/u);
  assert.match(shell, /data-route-direction=\{direction\}/u);
  assert.doesNotMatch(shell, /React\.ViewTransition|app-route-enter|app-route-exit/u);
  assert.match(motion, /\.t-route-enter\s*\{[\s\S]*var\(--motion-medium\)[\s\S]*backwards/u);
  assert.match(motion, /@keyframes t-route-enter-child[\s\S]*translateX\(24px\)[\s\S]*translateX\(0\)/u);
  assert.match(motion, /data-route-direction="root"[\s\S]*t-route-enter-root[\s\S]*translateY\(var\(--motion-distance-md\)\)/u);
  assert.match(motion, /data-route-direction="back"[\s\S]*t-route-enter-back/u);
  assert.doesNotMatch(motion, /t-route-exit|\.t-route-enter[^}]*animation-delay/u);
});

test("mobile document gestures prevent double-tap zoom and scroll chaining", async () => {
  const globals = await read("src/app/globals.css");
  assert.match(globals, /html\s*\{[\s\S]*touch-action: manipulation/u);
  assert.match(globals, /html\s*\{[\s\S]*overscroll-behavior: none/u);
  assert.match(globals, /body\s*\{[\s\S]*overscroll-behavior: none/u);
  assert.match(globals, /app-top-blur\s*\{[\s\S]*opacity: 0/u);
  assert.match(globals, /app-top-blur\[data-visible="true"\][\s\S]*opacity: 1/u);
});

test("mobile menus stay content-sized and navigation uses floating app geometry", async () => {
  const select = await read("src/components/ui/select.tsx");
  const dropdown = await read("src/components/ui/dropdown-menu.tsx");
  const shell = await read("src/components/app-shell.tsx");
  const globals = await read("src/app/globals.css");
  assert.match(select, /position = "popper"/u);
  assert.match(select, /collisionPadding=\{16\}/u);
  assert.match(select, /w-max max-w-\[calc\(100vw-2rem\)\]/u);
  assert.doesNotMatch(select, /(?:^|\s)min-w-\[var\(--radix-select-trigger-width\)\]/u);
  assert.match(select, /sm:min-w-\[var\(--radix-select-trigger-width\)\]/u);
  assert.match(select, /"w-full max-w-full min-w-0 scroll-my-1/u);
  assert.match(dropdown, /w-max max-w-\[calc\(100vw-2rem\)\]/u);
  assert.match(dropdown, /collisionPadding=\{16\}/u);
  assert.match(shell, /max-w-md rounded-full[^"]*px-3 py-1\.5/u);
  assert.match(shell, /className="mx-auto h-12"/u);
  assert.match(shell, /pb-\[calc\(6\.5rem\+min\(0\.625rem,var\(--safe-bottom\)\)\)\]/u);
  assert.match(shell, /isSecondaryMobileRoute\(pathname\)/u);
  assert.match(shell, /aria-hidden=\{!showMobileNavigation\}/u);
  assert.match(shell, /inert=\{!showMobileNavigation\}/u);
  assert.match(shell, /pb-\[max\(2rem,var\(--safe-bottom\)\)\]/u);
  assert.match(shell, /const \{ t \} = useLocaleSubscription\(\)/u);
  assert.match(shell, /issueHref, t, unread/u);
  assert.match(globals, /app-mobile-nav[\s\S]*bottom: max\(0\.9375rem, min\(1\.5625rem/u);
  assert.match(globals, /app-mobile-nav\[data-visible="true"\][\s\S]*visibility: visible/u);
  assert.match(globals, /app-mobile-nav \[data-liquid-nav-index\][\s\S]*border-radius: 9999px/u);
  assert.match(globals, /app-mobile-nav \[data-liquid-nav-index\] > span:last-child[\s\S]*text-overflow: ellipsis/u);
});

test("semantic controls preserve geometry while using compact shared type", async () => {
  const globals = await read("src/app/globals.css");
  const button = await read("src/components/ui/button.tsx");
  const tabs = await read("src/components/ui/tabs.tsx");
  const liquidTabs = await read("src/components/ui/liquid-tabs.tsx");
  assert.match(button, /text-\[0\.8125rem\]/u);
  assert.match(globals, /--segmented-font-size: 0\.8125rem/u);
  assert.match(
    globals,
    /\.t-tab-label\s*\{\s*font-size: var\(--segmented-font-size\);\s*\}/u,
  );
  assert.doesNotMatch(tabs, /text-\[length:var\(--segmented-font-size\)\]/u);
  assert.doesNotMatch(liquidTabs, /text-\[length:var\(--segmented-font-size\)\]/u);
  assert.match(liquidTabs, /h-\[1\.625rem\][\s\S]*px-3/u);
});

test("secondary mobile routes hide bottom navigation", async () => {
  const shell = await read("src/components/app-shell.tsx");
  for (const routePattern of [
    String.raw`pathname === "/issues/my-proposals"`,
    String.raw`pathname === "/dashboard"`,
    String.raw`pathname.startsWith("/admin/")`,
    String.raw`\/issues\/[^/]+\/(?:new|[^/]+)`,
    String.raw`\/facilities\/(?:new|[^/]+)`,
    String.raw`\/announcements\/(?:new|[^/]+)`,
  ]) assert.ok(shell.includes(routePattern), `missing secondary route rule ${routePattern}`);
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
