import { describe, expect, it } from "vitest";
import { isSharedRoute } from "../../src/constants/share";

describe("shared arrival detection", () => {
  it("recognises a single piece of content", () => {
    expect(isSharedRoute("/announcements/abc")).toBe(true);
    expect(isSharedRoute("/facilities/abc")).toBe(true);
    expect(isSharedRoute("/issues/proposal-a/abc")).toBe(true);
  });

  it("treats the front door, a feed and a composer as meeting Novae itself", () => {
    expect(isSharedRoute("/announcements")).toBe(false);
    expect(isSharedRoute("/announcements/new")).toBe(false);
    expect(isSharedRoute("/facilities/new")).toBe(false);
    expect(isSharedRoute("/issues")).toBe(false);
    expect(isSharedRoute("/issues/proposal-a")).toBe(false);
    expect(isSharedRoute("/issues/proposal-a/new")).toBe(false);
    expect(isSharedRoute("/settings")).toBe(false);
    expect(isSharedRoute("/admin/people")).toBe(false);
    expect(isSharedRoute("/issues/proposal-a/abc/extra")).toBe(false);
    expect(isSharedRoute("/")).toBe(false);
  });
});
