import { describe, expect, it } from "vitest";
import {
  adoptedParent,
  compareRoutes,
  isPrimaryRoute,
  showsPrimaryNavigation,
} from "@/lib/route-hierarchy";

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

  it("names the destinations primary navigation points at", () => {
    expect(isPrimaryRoute("/announcements")).toBe(true);
    expect(isPrimaryRoute("/settings")).toBe(true);
    // Every issue feed is the same destination under a different filter.
    expect(isPrimaryRoute("/issues/public")).toBe(true);
    expect(isPrimaryRoute("/issues/my-proposals")).toBe(true);

    expect(isPrimaryRoute("/issues")).toBe(false);
    expect(isPrimaryRoute("/issues/public/issue-1")).toBe(false);
    expect(isPrimaryRoute("/announcements/new")).toBe(false);
    expect(isPrimaryRoute("/admin")).toBe(false);
    expect(isPrimaryRoute("/admin/people")).toBe(false);
  });

  it("keeps the navigation bar on destinations and on the doorway to one", () => {
    expect(showsPrimaryNavigation("/issues")).toBe(true);
    expect(showsPrimaryNavigation("/issues/my-proposals")).toBe(true);
    expect(showsPrimaryNavigation("/notifications")).toBe(true);

    expect(showsPrimaryNavigation("/issues/public/new")).toBe(false);
    expect(showsPrimaryNavigation("/facilities/facility-1")).toBe(false);
    expect(showsPrimaryNavigation("/admin")).toBe(false);
    expect(showsPrimaryNavigation("/admin/people")).toBe(false);
  });

  it("places the administration area beneath settings", () => {
    expect(adoptedParent("/admin")).toBe("/settings");
    expect(adoptedParent("/admin/people")).toBe("/settings");
    expect(adoptedParent("/settings")).toBeNull();
    expect(adoptedParent("/announcements")).toBeNull();

    expect(compareRoutes("/settings", "/admin")).toBe("deeper");
    expect(compareRoutes("/admin", "/settings")).toBe("shallower");
    expect(compareRoutes("/admin", "/admin/people")).toBe("deeper");
    expect(compareRoutes("/admin/people", "/admin")).toBe("shallower");
    expect(compareRoutes("/admin/people", "/admin/audit")).toBe("unrelated");
  });
});
