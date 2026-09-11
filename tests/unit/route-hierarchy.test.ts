import { describe, expect, it } from "vitest";
import { adoptedParent, compareRoutes } from "@/lib/route-hierarchy";

describe("route hierarchy", () => {
  it("reads depth from the URL in both directions", () => {
    expect(compareRoutes("/issues/public", "/issues/public/issue-1")).toBe("deeper");
    expect(compareRoutes("/issues/public/issue-1", "/issues/public")).toBe("shallower");
    expect(compareRoutes("/announcements", "/announcements/new")).toBe("deeper");
    expect(compareRoutes("/facilities/facility-1", "/facilities")).toBe("shallower");
  });

  it("treats branch changes and sibling swaps as unrelated", () => {
    expect(compareRoutes("/issues/public", "/facilities")).toBe("unrelated");
    expect(compareRoutes("/issues/public", "/issues/my-proposals")).toBe("unrelated");
    expect(compareRoutes("/issues/public/issue-1", "/issues/public/issue-2")).toBe("unrelated");
    expect(compareRoutes("/announcements/new", "/announcements/announcement-1")).toBe("unrelated");
    expect(compareRoutes("/settings", "/settings")).toBe("unrelated");
  });

  it("gives the issues doorway no direction of its own", () => {
    // /issues renders nothing of its own: it picks a default category and
    // forwards. Reading that forward as a push played a whole child-route
    // animation on the way to a page the user had already asked for.
    expect(compareRoutes("/issues", "/issues/public")).toBe("unrelated");
    expect(compareRoutes("/issues/public", "/issues")).toBe("unrelated");
    expect(compareRoutes("/announcements", "/issues")).toBe("unrelated");
  });

  it("places the dashboard and administration areas beneath settings", () => {
    expect(adoptedParent("/admin/management")).toBe("/settings");
    expect(adoptedParent("/dashboard")).toBe("/settings");
    expect(adoptedParent("/settings")).toBeNull();
    expect(adoptedParent("/announcements")).toBeNull();

    expect(compareRoutes("/settings", "/dashboard")).toBe("deeper");
    expect(compareRoutes("/dashboard", "/settings")).toBe("shallower");
    expect(compareRoutes("/settings", "/admin/management")).toBe("deeper");
    expect(compareRoutes("/admin/access", "/settings")).toBe("shallower");
    expect(compareRoutes("/dashboard", "/admin/management")).toBe("unrelated");
  });
});
