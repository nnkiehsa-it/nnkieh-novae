import { describe, expect, it } from "vitest";

import { contentRouteTarget } from "@/lib/content-route";

describe("contentRouteTarget", () => {
  it("names the record a detail route is about", () => {
    expect(contentRouteTarget("/issues/my-proposals/issue-1")).toEqual({
      domain: "issue",
      id: "issue-1",
    });
    expect(contentRouteTarget("/facilities/facility-1")).toEqual({
      domain: "facility",
      id: "facility-1",
    });
    expect(contentRouteTarget("/announcements/announcement-1")).toEqual({
      domain: "announcement",
      id: "announcement-1",
    });
  });

  it("reads an identifier the URL had to escape", () => {
    expect(contentRouteTarget("/facilities/room%2F204")).toEqual({
      domain: "facility",
      id: "room/204",
    });
  });

  it("keeps feeds, composers and route placeholders out of it", () => {
    expect(contentRouteTarget("/issues/my-proposals")).toBeNull();
    expect(contentRouteTarget("/facilities")).toBeNull();
    expect(contentRouteTarget("/announcements/new")).toBeNull();
    expect(contentRouteTarget("/issues/my-proposals/new")).toBeNull();
    expect(contentRouteTarget("/announcements/__route-preload__")).toBeNull();
    expect(contentRouteTarget("/settings")).toBeNull();
  });
});
