import { describe, expect, it } from "vitest";
import { hidesDock, isRecordRoute, matchAppRoute, primaryDestination } from "@/lib/route-hierarchy";

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

  it("reads every in-app address into the screen it shows", () => {
    expect(matchAppRoute("/feed")).toEqual({ kind: "view", view: "feed" });
    expect(matchAppRoute("/admin")).toEqual({ kind: "admin", section: null });
    expect(matchAppRoute("/admin/people")).toEqual({ kind: "admin", section: "people" });
    expect(matchAppRoute("/issues/my%20filter/abc")).toEqual({ filter: "my filter", id: "abc", kind: "issue" });
    expect(matchAppRoute("/issues/public/compose/new")).toEqual({ filter: "public", kind: "issue-composer" });
    expect(matchAppRoute("/facilities/new")).toEqual({ kind: "facility-composer" });
    expect(matchAppRoute("/announcements/abc")).toEqual({ id: "abc", kind: "announcement" });
  });

  it("forwards old list addresses and unknown paths", () => {
    expect(matchAppRoute("/issues/public")).toEqual({ href: "/feed?view=issues&category=public", kind: "redirect" });
    expect(matchAppRoute("/facilities")).toEqual({ href: "/feed?view=facilities", kind: "redirect" });
    expect(matchAppRoute("/admin/unknown")).toEqual({ href: "/admin", kind: "redirect" });
    expect(matchAppRoute("/nowhere")).toEqual({ href: "/home", kind: "redirect" });
  });

  it("steps the dock aside for records, composers and setup", () => {
    expect(hidesDock("/announcements/new")).toBe(true);
    expect(hidesDock("/issues/public/compose/new")).toBe(true);
    expect(hidesDock("/issues/public/issue-1")).toBe(true);
    expect(hidesDock("/setup")).toBe(true);
    expect(hidesDock("/feed")).toBe(false);
    expect(hidesDock("/admin/people")).toBe(false);
  });
});
