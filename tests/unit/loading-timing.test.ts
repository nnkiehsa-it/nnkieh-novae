import { describe, expect, it } from "vitest";
import {
  MINIMUM_SKELETON_VISIBLE_DURATION_MS,
  SKELETON_APPEAR_DELAY_MS,
  getMinimumSkeletonWaitMs,
} from "@/lib/loading-timing";

describe("loading timing", () => {
  it("skips the minimum duration when data resolves before the skeleton appears", () => {
    expect(getMinimumSkeletonWaitMs(1_000, 1_000 + SKELETON_APPEAR_DELAY_MS - 1)).toBe(0);
  });

  it("keeps a visible skeleton mounted for the minimum visible duration", () => {
    expect(getMinimumSkeletonWaitMs(1_000, 1_000 + SKELETON_APPEAR_DELAY_MS)).toBe(
      MINIMUM_SKELETON_VISIBLE_DURATION_MS,
    );
    expect(
      getMinimumSkeletonWaitMs(
        1_000,
        1_000 + SKELETON_APPEAR_DELAY_MS + MINIMUM_SKELETON_VISIBLE_DURATION_MS,
      ),
    ).toBe(0);
  });
});
