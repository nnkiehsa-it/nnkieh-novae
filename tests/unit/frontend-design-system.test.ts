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
    expect(navigation).toContain("aria-current");
    expect(tabs).not.toContain("<Liquid");
    expect(navigation).not.toContain("<Liquid");
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
    expect(motion).toMatch(/@keyframes t-route-enter[\s\S]*translate/u);
  });

  it("keeps app controls real while only data fields use route skeletons", () => {
    const skeleton = read("src/components/ui/route-skeleton.tsx");
    expect(skeleton).toContain("<Button");
    expect(skeleton).toContain("<Input");
    expect(skeleton).toContain("<Textarea");
    expect(skeleton).toContain("<StableDetailToolbar />");
    expect(skeleton).not.toContain('Skeleton className="size-9 rounded-xl"');
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
