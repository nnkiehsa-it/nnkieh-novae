import { describe, expect, it } from "vitest";

import { diffDraft } from "@/lib/draft-diff";

describe("diffDraft", () => {
  it("reports nothing when a draft matches what is stored", () => {
    expect(diffDraft({ a: 1, b: "x" }, { a: 1, b: "x" })).toEqual([]);
  });

  it("names a changed field and carries both values", () => {
    expect(diffDraft({ a: 1, b: "x" }, { a: 2, b: "x" })).toEqual([
      { after: 2, before: 1, key: "a" },
    ]);
  });

  it("names a nested field by its group", () => {
    expect(
      diffDraft(
        { retention: { days: 30, enabled: true } },
        { retention: { days: 30, enabled: false } },
      ),
    ).toEqual([{ after: false, before: true, key: "retention.enabled" }]);
  });

  it("orders changes the same way whatever order the keys arrive in", () => {
    const before = { alpha: 1, zulu: 1 };
    expect(diffDraft(before, { zulu: 2, alpha: 2 }).map((change) => change.key)).toEqual([
      "alpha",
      "zulu",
    ]);
  });

  it("compares arrays by their entries rather than by identity", () => {
    expect(diffDraft({ ids: ["a"] }, { ids: ["a"] })).toEqual([]);
    expect(diffDraft({ ids: ["a"] }, { ids: ["b"] })).toEqual([
      { after: ["b"], before: ["a"], key: "ids" },
    ]);
  });
});
