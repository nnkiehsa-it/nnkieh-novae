import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("React frontend design system", () => {
  it("renders selected navigation state without measurement-dependent overlays", () => {
    const tabs = read("src/components/ui/liquid-tabs.tsx");
    const navigation = read("src/components/liquid-nav.tsx");
    expect(tabs).toContain('layoutId={`segmented-control-${indicatorId}`}');
    expect(tabs).toContain('type: "spring"');
    expect(tabs).toContain("useReducedMotion");
    expect(tabs).not.toContain("data-[state=active]:bg-card");
    expect(navigation).toContain("bg-secondary text-foreground");
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

  it("keeps route motion separate from skeleton-to-content sharpening", () => {
    const motion = read("src/styles/motion.css");
    const reveal = motion.match(/@keyframes t-reveal-content\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
    const dataReveal = motion.match(/@keyframes t-data-content-enter\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
    const initialStagger = motion.match(/@keyframes t-stagger-item\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(reveal).toContain("filter: blur");
    expect(reveal).not.toContain("translate");
    expect(dataReveal).toContain("translateY(2px)");
    expect(initialStagger).not.toContain("translate");
    expect(initialStagger).not.toContain("filter");
    expect(motion).toContain(".t-stagger-copy");
    expect(motion).toMatch(/@keyframes t-route-enter[\s\S]*translate/u);
  });

  it("keeps app controls real while only data fields use route skeletons", () => {
    const skeleton = read("src/components/ui/route-skeleton.tsx");
    const issueCard = read("src/components/issues/issue-card.tsx");
    const facilityCard = read("src/components/facilities/facility-card.tsx");
    const announcementCard = read("src/components/announcements/announcement-card.tsx");
    expect(skeleton).toContain("<Button");
    expect(skeleton).toContain("<Input");
    expect(skeleton).toContain("<Textarea");
    expect(skeleton).toContain("<StableDetailToolbar />");
    expect(skeleton).toContain("line-clamp-2");
    expect(skeleton).toContain("stripMarkdownImages(content)");
    expect(skeleton).not.toContain('Skeleton className="size-9 rounded-xl"');
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

  it("keeps route modules composed from reusable domain components", () => {
    const issueDetail = read("src/app/(protected)/issues/[filter]/[issueId]/page.tsx");
    expect(issueDetail).toContain("<IssueDetailContent");
    expect(issueDetail).toContain("<IssueDetailSidebar");
    expect(issueDetail).toContain("<IssueModerationDialog");
    expect(issueDetail.split(/\r?\n/u).length).toBeLessThan(350);
  });

  it("owns dialog, dropdown, card, and control styling in shared primitives", () => {
    expect(read("src/components/ui/button.tsx")).toContain("buttonVariants");
    expect(read("src/components/ui/card.tsx")).toContain('data-slot="card"');
    expect(read("src/components/ui/dialog.tsx")).toContain('data-slot="dialog-content"');
    expect(read("src/components/ui/dropdown-menu.tsx")).toContain('data-slot="dropdown-menu-content"');
  });

  it("keeps page headers concise and product terminology consistent", () => {
    const pageState = read("src/components/ui/page-state.tsx");
    const i18nCheck = read("scripts/check-i18n.mjs");
    expect(pageState).not.toContain("description?:");
    expect(pageState).not.toContain("eyebrow?:");
    for (const term of ["連署", "連屬", "設備回報", "設備報修", "報修", "校園提案", "討論留言"]) {
      expect(i18nCheck).toContain(`"${term}"`);
    }
  });
});
