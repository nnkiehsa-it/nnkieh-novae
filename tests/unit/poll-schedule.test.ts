import { describe, expect, it } from "vitest";

import { nextPollDelay } from "@/lib/poll-schedule";

describe("nextPollDelay", () => {
  it("answers quickly on the first look", () => {
    expect(nextPollDelay(0)).toBe(1_000);
  });

  it("waits longer each time the answer has not changed", () => {
    const waits = [0, 1, 2, 3, 4].map(nextPollDelay);
    expect(waits).toEqual([1_000, 2_000, 3_000, 5_000, 8_000]);
    expect(waits.every((wait, index) => index === 0 || wait > waits[index - 1])).toBe(true);
  });

  it("settles at a steady rate rather than growing without bound", () => {
    expect(nextPollDelay(5)).toBe(15_000);
    expect(nextPollDelay(50)).toBe(15_000);
  });
});
