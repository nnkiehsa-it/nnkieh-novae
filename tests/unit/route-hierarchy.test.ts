import { describe, expect, it } from "vitest";
import { adoptedParent, compareRoutes, isPrimaryRoute, opensOverRoute, recordListPath, showsPrimaryNavigation } from "@/lib/route-hierarchy";

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

    expect(showsPrimaryNavigation("/issues/public/compose/new")).toBe(false);
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

describe("a record opened over its source page", () => {
  it("recognises the records a list shows", () => {
    expect(opensOverRoute("/issues/school", "/issues/school/abc")).toBe(true);
    expect(opensOverRoute("/announcements", "/announcements/abc")).toBe(true);
    expect(opensOverRoute("/facilities", "/facilities/abc")).toBe(true);
  });

  it("opens records from notifications, administration and other feeds", () => {
    expect(opensOverRoute("/notifications", "/issues/school/abc")).toBe(true);
    expect(opensOverRoute("/notifications", "/facilities/abc")).toBe(true);
    expect(opensOverRoute("/notifications", "/announcements/abc")).toBe(true);
    expect(opensOverRoute("/admin", "/issues/school/abc")).toBe(true);
    expect(opensOverRoute("/issues/school", "/issues/other/abc")).toBe(true);
    expect(opensOverRoute("/announcements", "/facilities/abc")).toBe(true);
    expect(opensOverRoute("/settings", "/announcements/abc")).toBe(true);
  });

  it("does not intercept composers, feeds, or arrivals from outside the protected shell", () => {
    expect(opensOverRoute("/issues/school", "/issues/school/compose/new")).toBe(false);
    expect(opensOverRoute("/announcements", "/announcements")).toBe(false);
    expect(opensOverRoute("/login", "/announcements/abc")).toBe(false);
    expect(opensOverRoute("/announcements/abc", "/announcements/abc")).toBe(false);
  });

  it("gives direct record arrivals a deterministic owning list", () => {
    expect(recordListPath("/issues/school/abc")).toBe("/issues/school");
    expect(recordListPath("/announcements/abc")).toBe("/announcements");
    expect(recordListPath("/facilities/abc")).toBe("/facilities");
    expect(recordListPath("/announcements/new")).toBe("/announcements/new");
  });
});
