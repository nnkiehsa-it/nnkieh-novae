import { describe, expect, it } from "vitest";
import { canLoadAnotherFeedPage, limitRetainedFeedItems } from "../../src/lib/feed-page-limit";
import { DEFAULT_OPERATION_POLICIES } from "../../shared/operation-policies.ts";
const MAX_RETAINED_FEED_PAGES = DEFAULT_OPERATION_POLICIES.feedPages;

describe("feed page retention", () => {
  it("stops loading at the configured page limit", () => {
    expect(canLoadAnotherFeedPage(MAX_RETAINED_FEED_PAGES - 1, true)).toBe(true);
    expect(canLoadAnotherFeedPage(MAX_RETAINED_FEED_PAGES, true)).toBe(false);
  });

  it("keeps backend exhaustion authoritative before the limit", () => {
    expect(canLoadAnotherFeedPage(2, false)).toBe(false);
  });

  it("caps realtime insertions to the same retained-page window", () => {
    const items = Array.from({ length: 8 }, (_, index) => index);
    expect(limitRetainedFeedItems(items, 1)).toEqual([0, 1, 2, 3, 4]);
  });
});
