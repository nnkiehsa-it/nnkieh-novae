import { describe, expect, it } from "vitest";
import {
  reconcileReactionState,
  recordReactionMutation,
} from "../../src/lib/reaction-state";

describe("reaction state reconciliation", () => {
  it("lets detail state replace an older list snapshot", () => {
    const scope = "detail-priority";
    reconcileReactionState(scope, "issue", "issue-1", { active: false, count: 4 }, "list");
    expect(
      reconcileReactionState(scope, "issue", "issue-1", { active: true, count: 5 }, "detail"),
    ).toEqual({ active: true, count: 5 });
  });

  it("keeps a successful mutation ahead of later cached reads", () => {
    const scope = "mutation-priority";
    recordReactionMutation(scope, "announcement", "announcement-1", {
      active: true,
      count: 8,
    });
    expect(
      reconcileReactionState(
        scope,
        "announcement",
        "announcement-1",
        { active: false, count: 7 },
        "detail",
      ),
    ).toEqual({ active: true, count: 8 });
  });

  it("isolates reaction snapshots by signed-in user", () => {
    recordReactionMutation("user-a", "facility", "facility-1", {
      active: true,
      count: 3,
    });
    expect(
      reconcileReactionState(
        "user-b",
        "facility",
        "facility-1",
        { active: false, count: 2 },
        "list",
      ),
    ).toEqual({ active: false, count: 2 });
  });
});
