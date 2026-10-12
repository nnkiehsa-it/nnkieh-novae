import { describe, expect, it } from "vitest";
import { hidesDock, isRecordRoute, primaryDestination } from "@/lib/route-hierarchy";

describe("route hierarchy", () => {
  it("files records, composers and old list addresses under the feed", () => {
    expect(primaryDestination("/issues/public/issue-1")).toBe("/feed");
    expect(primaryDestination("/issues/public/compose/new")).toBe("/feed");
    expect(primaryDestination("/facilities/facility-1")).toBe("/feed");
    expect(primaryDestination("/announcements")).toBe("/feed");
    expect(primaryDestination("/feed")).toBe("/feed");
  });

  it("places the administration area beneath settings", () => {
    expect(primaryDestination("/admin")).toBe("/settings");
    expect(primaryDestination("/admin/people")).toBe("/settings");
    expect(primaryDestination("/administrator")).toBe("/administrator");
    expect(primaryDestination("/settings")).toBe("/settings");
  });

  it("recognises one piece of content but not a composer", () => {
    expect(isRecordRoute("/issues/public/issue-1")).toBe(true);
    expect(isRecordRoute("/facilities/abc")).toBe(true);
    expect(isRecordRoute("/announcements/abc")).toBe(true);
    expect(isRecordRoute("/announcements/new")).toBe(false);
    expect(isRecordRoute("/facilities/new")).toBe(false);
    expect(isRecordRoute("/issues/public")).toBe(false);
  });

  it("steps the dock aside for composers and setup only", () => {
    expect(hidesDock("/announcements/new")).toBe(true);
    expect(hidesDock("/issues/public/compose/new")).toBe(true);
    expect(hidesDock("/setup")).toBe(true);
    expect(hidesDock("/feed")).toBe(false);
    expect(hidesDock("/issues/public/issue-1")).toBe(false);
  });
});
