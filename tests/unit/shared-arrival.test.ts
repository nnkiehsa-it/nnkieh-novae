import { describe, expect, it } from "vitest";
import { isSharedRoute } from "../../src/lib/share";

describe("shared arrival detection", () => {
  it("recognises the pages a share button exists on", () => {
    expect(isSharedRoute("/announcements/abc")).toBe(true);
    expect(isSharedRoute("/facilities/abc")).toBe(true);
    expect(isSharedRoute("/issues/proposal-a/abc")).toBe(true);
  });

  it("leaves composers, feeds and everything above them alone", () => {
    expect(isSharedRoute("/announcements")).toBe(false);
    expect(isSharedRoute("/announcements/new")).toBe(false);
    expect(isSharedRoute("/facilities/new")).toBe(false);
    expect(isSharedRoute("/issues")).toBe(false);
    expect(isSharedRoute("/issues/proposal-a")).toBe(false);
    expect(isSharedRoute("/issues/proposal-a/new")).toBe(false);
    expect(isSharedRoute("/settings")).toBe(false);
    expect(isSharedRoute("/admin/people")).toBe(false);
    expect(isSharedRoute("/issues/proposal-a/abc/extra")).toBe(false);
  });
});
