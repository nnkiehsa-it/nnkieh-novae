import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("React frontend design system", () => {
  it("renders selected navigation state without measurement-dependent overlays", () => {
    const tabs = read("src/components/ui/liquid-tabs.tsx");
    const navigation = read("src/components/liquid-nav.tsx");
    expect(tabs).toContain("t-tabs-pill");
    expect(tabs).toContain("t-tab");
    expect(tabs).toContain('import { motion } from "motion/react"');
    expect(tabs).toContain("layoutId={`liquid-tab-pill-${layoutId}`}");
    expect(tabs).toContain('type: "spring"');
    expect(tabs).not.toContain("offsetLeft");
    expect(tabs).not.toContain("ResizeObserver");
    expect(tabs).not.toContain("data-[state=active]:bg-card");
    expect(navigation).toContain("bg-[var(--nav-active-bg)] text-[var(--nav-active-fg)]");
    expect(navigation).toContain("pendingRoute");
    expect(navigation).toContain("onPointerDown");
    expect(navigation).toContain("onPointerEnter");
    expect(navigation).toContain("router.prefetch(item.href)");
    expect(navigation).toContain("aria-current");
    expect(tabs).not.toContain("<Liquid");
    expect(navigation).not.toContain("<Liquid");
  });

  it("gives push mutations targeted spinner-to-check feedback", () => {
    const settings = read("src/app/(protected)/settings/page.tsx");
    const notificationCard = read("src/components/settings/notification-card.tsx");
    expect(settings).toContain("useActionFeedback");
    expect(settings).toContain('setNotificationFeedbackTarget("device")');
    expect(notificationCard).toContain("ActionFeedbackIcon");
    expect(notificationCard).toContain('feedbackTarget === "device"');
  });

  it("centers shared spinners and keeps startup loading transparent", () => {
    const motion = read("src/styles/motion.css");
    const spinner = read("src/components/ui/loading-spinner.tsx");
    expect(motion).toMatch(/\.t-spinner \{[\s\S]*display: block[\s\S]*transform-origin: 50% 50%/u);
    expect(motion).toMatch(/\.t-loading-spinner \{[\s\S]*place-items: center[\s\S]*line-height: 0/u);
    expect(motion).toMatch(/@keyframes t-spinner-orbit[\s\S]*translate3d/u);
    expect(motion).toMatch(/@keyframes t-spinner-turn[\s\S]*rotate\(360deg\)/u);
    expect(spinner).toContain('data-slot="loading-spinner"');
    expect(motion).toMatch(/\.t-spinner-check \{[\s\S]*line-height: 0[\s\S]*vertical-align: middle/u);
    expect(motion).not.toContain(".t-loading-orbit");
  });

  it("reveals images only after decoding and gives loading and failure feedback", () => {
    const decodedImage = read("src/components/ui/decoded-image.tsx");
    const avatar = read("src/components/ui/avatar.tsx");
    const renderer = read("src/components/content-renderer.tsx");
    const composer = read("src/components/composer-fields.tsx");
    const brand = read("src/components/ui/brand.tsx");
    const motion = read("src/styles/motion.css");
    expect(decodedImage).toContain("image.decode()");
    expect(decodedImage).toContain("<LoadingSpinner");
    expect(decodedImage).toContain("<ImageOff");
    expect(decodedImage).toContain('data-image-state={state}');
    expect(avatar).toContain("onLoadingStatusChange");
    expect(avatar).toContain('<LoadingSpinner className="size-3.5"');
    for (const source of [renderer, composer, brand]) {
      expect(source).toContain("<DecodedImage");
    }
    expect(renderer).toContain('FORBID_TAGS: ["img"]');
    expect(motion).toContain('@keyframes t-image-ready');
  });

  it("applies saved image settings locally and limits only compressed output size", () => {
    const platformSettings = read("src/hooks/use-platform-settings.ts");
    const categories = read("src/hooks/use-categories.ts");
    const imageProcessing = read("src/lib/image-processing.ts");
    const settingsUi = read("src/components/admin/platform-settings.tsx");
    expect(platformSettings).toContain("seedImageUploadSettings(saved.imageUploads)");
    expect(platformSettings).not.toContain("categories.refresh()");
    expect(categories).toContain("export function seedImageUploadSettings");
    expect(imageProcessing).not.toContain("maxImageSourceBytes");
    expect(imageProcessing).not.toContain("image.sourceTooLarge");
    expect(settingsUi).not.toContain("imageSourceMegabytes");
  });

  it("keeps route containers static while skeleton fields cross-fade cheaply", () => {
    const motion = read("src/styles/motion.css");
    const skeletonReveal = read("src/components/ui/skeleton-reveal.tsx");
    const initialStagger = motion.match(/@keyframes t-stagger-item\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(motion).toContain(".t-skel.is-revealed .t-skel-content");
    expect(motion).not.toContain("--reveal-blur");
    expect(motion).toMatch(/\.t-skel-content \{[\s\S]*transition: opacity var\(--reveal-dur\)/u);
    expect(skeletonReveal).not.toContain("useEffect");
    expect(skeletonReveal).toContain('className={cn("t-skel is-revealed"');
    expect(motion).toContain("@starting-style");
    expect(skeletonReveal).toContain('data-block={as === "div"');
    expect(initialStagger).not.toContain("translate");
    expect(initialStagger).not.toContain("filter");
    expect(motion).not.toContain("t-data-content-enter");
    expect(motion).not.toContain("t-stagger-copy");
    expect(motion).not.toContain("t-reveal-content");
    expect(motion).toContain("--skeleton-appear-delay: 0ms");
    expect(motion).toContain("--reveal-dur: 240ms");
    expect(motion).not.toContain("t-route-blur");
    expect(motion).not.toContain("t-route-enter");
    expect(read("src/components/app-shell.tsx")).toContain('<div className="route-page">{children}</div>');
    expect(read("src/components/app-shell.tsx")).not.toContain("RouteTransition");
    expect(read("src/components/app-shell.tsx")).not.toContain("ViewTransition");
    expect(read("src/components/liquid-nav.tsx")).not.toContain("transitionTypes");
  });

  it("centers status labels through cold reveal and extends the stage into iOS chrome", () => {
    const statusBadge = read("src/components/ui/status-badge.tsx");
    const issueDetail = read("src/components/issues/issue-detail-content.tsx");
    const facilityDetail = read("src/components/facilities/facility-detail-content.tsx");
    const skeletonReveal = read("src/components/ui/skeleton-reveal.tsx");
    const layout = read("src/app/layout.tsx");
    const globals = read("src/app/globals.css");
    const manifest = read("src/app/manifest.ts");
    expect(skeletonReveal).toContain("export function SkeletonBadgeLabel");
    expect(skeletonReveal).toContain('cn("inline-grid place-items-center text-center"');
    for (const source of [statusBadge, issueDetail, facilityDetail]) {
      expect(source).toContain("<SkeletonBadgeLabel");
    }
    expect(layout).toContain('statusBarStyle: "black-translucent"');
    expect(layout).toContain('viewportFit: "cover"');
    expect(globals.match(/background: var\(--surface-stage\)/gu)?.length).toBeGreaterThanOrEqual(2);
    expect(manifest).toContain('theme_color: "#f9f9f9"');
  });

  it("omits proposal discussion when its category has no comment capability", () => {
    const issueDetailPage = read("src/app/(protected)/issues/[filter]/[issueId]/page.tsx");
    const issueDetailHook = read("src/hooks/use-issue-detail.ts");
    expect(issueDetailPage).toContain("detail.commentsAvailable ?");
    expect(issueDetailHook).toMatch(/commentsAvailable[\s\S]*issueCategoryAllowsComments/u);
    expect(issueDetailHook).toMatch(/commentsReadable[\s\S]*commentsAvailable/u);
  });

  it("keeps discussion in a card with a safe-area fixed reply composer", () => {
    const discussion = read("src/components/discussion.tsx");
    const composer = read("src/components/comments/comment-composer.tsx");
    const thread = read("src/components/comments/comment-thread.tsx");
    const globals = read("src/app/globals.css");
    const layout = read("src/app/layout.tsx");
    expect(discussion).toContain('<ResizableCard className="gap-0 overflow-hidden py-0">');
    expect(discussion).toContain('className="discussion-composer-dock"');
    expect(discussion).toContain('new ResizeObserver(updateClearance)');
    expect(discussion).toContain('--discussion-composer-height');
    expect(discussion).not.toContain('window.innerHeight');
    expect(discussion).not.toContain('window.visualViewport');
    expect(discussion).toContain("characters.slice(0, 20)");
    expect(discussion).toContain('translate("ui.discussion.replying"');
    expect(composer).toContain('import { ArrowUp } from "lucide-react"');
    expect(composer).toContain('className="flex min-h-10 items-center gap-3 px-1"');
    expect(composer).toContain('Avatar className="size-10 border bg-background"');
    expect(composer).toContain('focus-visible:outline-none focus-visible:ring-0');
    expect(composer).toContain('className="size-10 min-h-10 min-w-10 shrink-0 rounded-full"');
    expect(composer).toContain('size="icon-lg"');
    expect(composer).not.toContain("rounded-2xl border bg-muted/35");
    expect(thread).toContain("onReply(reply, comment.id)");
    expect(globals).toMatch(/\.discussion-composer-dock \{[\s\S]*position: fixed/u);
    expect(globals).toContain("bottom: max(0.75rem, var(--safe-bottom))");
    expect(layout).not.toContain('interactiveWidget: "resizes-content"');
  });

  it("warms privileged route shells immediately and gives them one mobile toolbar", () => {
    const preload = read("src/hooks/use-route-preload.ts");
    const dashboard = read("src/app/(protected)/dashboard/page.tsx");
    const administration = read("src/app/(protected)/admin/management/page.tsx");
    const navigationMemory = read("src/lib/navigation-memory.ts");
    expect(preload).toContain('router.prefetch("/dashboard")');
    expect(preload).toContain('router.prefetch("/admin/management?tab=categories")');
    expect(preload).toContain('router.prefetch("/admin/management?tab=members")');
    expect(dashboard).toContain("<SecondaryToolbar");
    expect(administration).toContain("<SecondaryToolbar");
    expect(navigationMemory).toContain("returnToPreviousInAppRoute");
    expect(read("src/app/(protected)/dashboard/loading.tsx")).toContain("DashboardSkeleton");
    expect(read("src/app/(protected)/admin/management/loading.tsx")).toContain("AdministrationSkeleton");
  });

  it("keeps app controls real while only data fields use route skeletons", () => {
    const skeleton = read("src/components/ui/route-skeleton.tsx");
    const announcementLoading = read("src/app/(protected)/announcements/loading.tsx");
    const issueCard = read("src/components/issues/issue-card.tsx");
    const facilityCard = read("src/components/facilities/facility-card.tsx");
    const announcementCard = read("src/components/announcements/announcement-card.tsx");
    const resolutionNotice = read("src/components/content-resolution-notice.tsx");
    expect(skeleton).toContain("<Button");
    expect(skeleton).toContain("export function FeedEmptyState");
    expect(skeleton).toContain("route-card-skeleton h-full gap-4 p-5 sm:p-6");
    expect(skeleton).toContain('kind !== "announcement" ?');
    expect(skeleton).toContain('showCreate ? (');
    expect(announcementLoading).toContain('session.can("announcement.manage")');
    expect(skeleton).toContain("<Input");
    expect(skeleton).toContain("<Textarea");
    expect(skeleton).toContain("<StableDetailToolbar />");
    expect(skeleton).not.toContain("stripMarkdownImages(content)");
    expect(skeleton).not.toContain("content?: string");
    expect(skeleton).toMatch(/export function DetailRouteSkeleton\(\{\s*kind = "issue",\s*\}/u);
    expect(skeleton).toContain('kind === "announcement"');
    expect(skeleton).not.toContain("index % 2");
    expect(skeleton).toContain('const isIssue = kind === "issue"');
    expect(skeleton).toContain('const isFacility = kind === "facility"');
    expect(skeleton).not.toContain('min-h-[25rem]');
    expect(skeleton).not.toContain('Skeleton className="size-9 rounded-xl"');
    expect(skeleton).not.toContain("ContentResolutionNoticeSkeleton");
    expect(resolutionNotice).toContain("ContentResolutionNoticeSkeleton");
    expect(issueCard).not.toContain('t-data-content-enter flex h-full');
    expect(facilityCard).not.toContain('t-data-content-enter flex h-full');
    expect(announcementCard).not.toContain('t-data-content-enter flex h-full');
    expect(issueCard).toMatch(/<LikeActionButton[\s\S]*className="z-10 ml-auto"/u);
    expect(issueCard).not.toMatch(/t-data-content-enter[^\n]*<LikeActionButton/u);
    expect(facilityCard).not.toMatch(/t-data-content-enter[^\n]*<LikeActionButton/u);
    expect(announcementCard).not.toMatch(/t-data-content-enter[^\n]*<LikeActionButton/u);
    for (const card of [issueCard, facilityCard, announcementCard]) {
      expect(card).toContain('className="absolute inset-0 rounded-xl');
      expect(card).not.toContain("after:absolute after:inset-0");
    }
  });

  it("keeps card copy unscaled while animating surrounding layout", () => {
    const card = read("src/components/ui/card.tsx");
    const resizableCard = read("src/components/ui/resizable-card.tsx");
    expect(card).toContain("t-resize flex flex-col");
    expect(card).not.toContain('"use client"');
    expect(resizableCard).toContain('layout="position"');
    expect(resizableCard).not.toContain("layout\n");
    expect(resizableCard).toContain("transition={{ layout: cardLayoutTransition }}");
    expect(resizableCard).toContain("duration: 0.3");
    expect(resizableCard).toContain("ease: [0.22, 1, 0.36, 1]");
    expect(read("src/components/discussion.tsx")).toContain("<ResizableCard");
  });

  it("keeps the startup fallback inside the same iOS safe-area surface", () => {
    const providers = read("src/components/app-providers.tsx");
    const startup = read("src/components/protected-app.tsx");
    const globals = read("src/app/globals.css");
    expect(providers).toContain('className="app-start-surface"');
    expect(startup).toContain('className="app-start-surface grid place-items-center"');
    expect(globals).toMatch(/\.app-start-surface \{[\s\S]*min-height: 100svh/u);
    expect(globals).toMatch(/\.app-start-surface \{[\s\S]*var\(--safe-top\)[\s\S]*var\(--safe-bottom\)/u);
  });

  it("disables tooltip layers without fine-pointer hover capability", () => {
    const tooltip = read("src/components/ui/tooltip.tsx");
    expect(tooltip).toContain('(hover: hover) and (pointer: fine)');
    expect(tooltip).toContain('const open = enabled &&');
    expect(tooltip).toContain('open={open}');
    expect(tooltip).toContain("useSyncExternalStore");
  });

  it("centralizes motion and honors reduced motion and hover capability", () => {
    const globals = read("src/app/globals.css");
    const motion = read("src/styles/motion.css");
    expect(motion).toContain("--motion-fast");
    expect(motion).toContain("--ease-smooth-out");
    expect(motion).toContain("@media (prefers-reduced-motion: reduce)");
    expect(`${globals}\n${motion}`).toMatch(/@media \(hover: hover\).*\(pointer: fine\)/s);
    expect(`${globals}\n${motion}`).not.toContain("transition-all");
  });

  it("keeps focus feedback intentional across pointer capabilities", () => {
    const globals = read("src/app/globals.css");
    const settings = read("src/app/(protected)/settings/page.tsx");
    const settingsLoading = read("src/app/(protected)/settings/loading.tsx");
    expect(globals).toContain('[data-slot="dialog-content"]:focus-visible');
    expect(globals).toMatch(/@media \(hover: none\), \(pointer: coarse\)[\s\S]*:focus-visible,[\s\S]*:focus-within/s);
    expect(settings).toContain('<div className="w-full space-y-5">');
    expect(settingsLoading).toContain('<div className="w-full space-y-5" aria-busy="true">');
  });

  it("paints dense scrolling content before it reaches the viewport", () => {
    const globals = read("src/app/globals.css");
    const motion = read("src/styles/motion.css");
    const stagger = read("src/components/motion/stagger.tsx");
    const renderer = read("src/components/content-renderer.tsx");
    expect(`${globals}\n${motion}`).not.toContain("content-visibility: auto");
    expect(`${globals}\n${motion}`).not.toContain("contain-intrinsic-size");
    expect(stagger).not.toContain("IntersectionObserver");
    expect(stagger).not.toContain("data-visible");
    expect(renderer).toContain('loading="eager"');
    expect(renderer).toContain('fetchPriority="low"');
  });

  it("keeps route modules composed from reusable domain components", () => {
    const issueDetail = read("src/app/(protected)/issues/[filter]/[issueId]/page.tsx");
    expect(issueDetail).toContain("<IssueDetailContent");
    expect(issueDetail).toContain("<IssueDetailSidebar");
    expect(issueDetail).toContain("<IssueModerationDialog");
    expect(issueDetail.split(/\r?\n/u).length).toBeLessThan(350);
  });

  it("owns dialog, dropdown, card, and control styling in shared primitives", () => {
    const button = read("src/components/ui/button.tsx").replace(/\r\n/gu, "\n");
    const dialog = read("src/components/ui/dialog.tsx");
    const alertDialog = read("src/components/ui/alert-dialog.tsx");
    expect(button).toContain("buttonVariants");
    expect(button).toContain('data-control-label=""');
    expect(button).toContain('default:\n          "bg-card text-card-foreground');
    expect(button).not.toContain('default: "bg-primary text-primary-foreground');
    expect(alertDialog).toMatch(/function AlertDialogCancel[\s\S]*variant = "default"/u);
    expect(read("src/app/globals.css")).not.toContain("--theme-primary-");
    expect(read("src/theme/accent-theme.ts")).not.toContain("accentButtonColors");
    expect(read("src/components/ui/card.tsx")).toContain('data-slot="card"');
    expect(dialog).toContain('data-slot="dialog-content"');
    expect(dialog).toContain("fixed inset-0 z-50 grid place-items-center");
    expect(alertDialog).toContain("fixed inset-0 z-50 grid place-items-center");
    expect(read("src/components/ui/dropdown-menu.tsx")).toContain('data-slot="dropdown-menu-content"');
  });

  it("shows focus rings only while keyboard input is active", () => {
    const providers = read("src/components/app-providers.tsx");
    const globals = read("src/app/globals.css");
    expect(providers).toContain('setModality("keyboard")');
    expect(providers).toContain('setModality("pointer")');
    expect(providers).toContain('window.addEventListener("pointermove"');
    expect(providers).toContain('window.addEventListener("pointerdown"');
    expect(providers).toContain('window.addEventListener("keydown"');
    expect(globals).toContain('html[data-input-modality="pointer"] :focus-visible');
    expect(globals).toMatch(/data-input-modality="pointer"[\s\S]*--tw-ring-shadow: 0 0 #0000 !important;[\s\S]*outline: none !important;/u);
  });

  it("keeps page headers concise and product terminology consistent", () => {
    const pageState = read("src/components/ui/page-state.tsx");
    const i18nCheck = read("scripts/check-i18n.mjs");
    expect(pageState).toContain("description?: React.ReactNode");
    expect(pageState).not.toContain("eyebrow?:");
    for (const term of ["連署", "連屬", "設備回報", "設備報修", "報修", "校園提案", "討論留言"]) {
      expect(i18nCheck).toContain(`"${term}"`);
    }
  });
});
