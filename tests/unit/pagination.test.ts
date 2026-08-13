import { describe, expect, it } from "vitest";
import { canContinuePage, mergePageById } from "../../src/lib/pagination";

describe("pagination helpers", () => {
  it("deduplicates overlapping pages and keeps the newest record", () => {
    expect(
      mergePageById(
        [{ id: "a", value: 1 }, { id: "b", value: 2 }],
        [{ id: "b", value: 3 }, { id: "c", value: 4 }],
      ),
    ).toEqual([
      { id: "a", value: 1 },
      { id: "b", value: 3 },
      { id: "c", value: 4 },
    ]);
  });

  it("stops when the backend repeats a cursor", () => {
    const cursor = { id: "same", createdAt: "2026-08-13" };
    expect(canContinuePage(cursor, cursor, true)).toBe(false);
    expect(canContinuePage(null, cursor, true)).toBe(true);
    expect(canContinuePage(cursor, { ...cursor, id: "next" }, true)).toBe(true);
  });
});
