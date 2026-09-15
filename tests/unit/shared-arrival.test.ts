import { describe, expect, it } from "vitest";
import { isSharedRoute, sharedDestinationPath } from "../../src/constants/share";

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

describe("the page a load is about", () => {
  it("reads the page sign-in is holding, not the sign-in page", () => {
    expect(sharedDestinationPath("https://novae.test/login?redirect=%2Fissues%2Fproposal-a%2Fabc"))
      .toBe("/issues/proposal-a/abc");
    expect(isSharedRoute(
      sharedDestinationPath("https://novae.test/login?redirect=%2Fannouncements%2Fabc"),
    )).toBe(true);
  });

  it("keeps its own address when nothing is being held for the reader", () => {
    expect(sharedDestinationPath("https://novae.test/issues/proposal-a/abc"))
      .toBe("/issues/proposal-a/abc");
    expect(sharedDestinationPath("https://novae.test/login")).toBe("/login");
    expect(isSharedRoute(sharedDestinationPath("https://novae.test/login?redirect=%2Fissues")))
      .toBe(false);
  });

  it("refuses a redirect that leaves Novae", () => {
    expect(sharedDestinationPath("https://novae.test/login?redirect=https%3A%2F%2Felsewhere.test%2Fx"))
      .toBe("/login");
    expect(sharedDestinationPath("https://novae.test/login?redirect=%2F%2Felsewhere.test%2Fx"))
      .toBe("/login");
  });
});
