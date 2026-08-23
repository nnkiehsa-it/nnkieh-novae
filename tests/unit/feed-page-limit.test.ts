import { describe, expect, it } from "vitest";
import {
  MAX_RETAINED_FEED_PAGES,
  advanceFeedPageCount,
  canLoadAnotherFeedPage,
  limitRetainedFeedItems,
} from "../../src/lib/feed-page-limit";

describe("feed page retention", () => {
  it("resets a new query to its first page", () => {
    expect(advanceFeedPageCount(4, false)).toBe(1);
  });

  it("stops advancing and loading at the configured page limit", () => {
    expect(advanceFeedPageCount(MAX_RETAINED_FEED_PAGES, true))
      .toBe(MAX_RETAINED_FEED_PAGES);
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
