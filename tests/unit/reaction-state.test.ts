import { describe, expect, it } from "vitest";
import { toggleReactionState } from "../../src/lib/reaction-state";

describe("toggleReactionState", () => {
  it("optimistically activates and increments a reaction", () => {
    expect(toggleReactionState({ active: false, count: 2 })).toEqual({
      active: true,
      count: 3,
    });
  });

  it("optimistically removes a reaction without producing a negative count", () => {
    expect(toggleReactionState({ active: true, count: 0 })).toEqual({
      active: false,
      count: 0,
    });
  });
});
