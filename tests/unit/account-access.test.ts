import { describe, expect, it } from "vitest";
import { selectAccountAccessRule, type AccountAccessRule } from "../../cloudflare/src/backend/shared/account-access";

function rule(targetType: AccountAccessRule["targetType"], targetValue: string, preset: AccountAccessRule["preset"]): AccountAccessRule {
  return { expiresAt: null, message: targetValue, preset, targetType, targetValue };
}

describe("account access rule resolution", () => {
  it("prefers an exact uid over matching prefixes", () => {
    const resolved = selectAccountAccessRule([
      rule("email_prefix", "hs", "blocked"),
      rule("uid", "member-1", "reaction_only"),
    ], { email: "HS100@example.test", uid: "member-1" });
    expect(resolved?.preset).toBe("reaction_only");
  });

  it("uses the longest case-insensitive local-part prefix", () => {
    const resolved = selectAccountAccessRule([
      rule("email_prefix", "h", "read_only"),
      rule("email_prefix", "hs", "blocked"),
    ], { email: "HS100@example.test", uid: "member-2" });
    expect(resolved?.targetValue).toBe("hs");
  });
});
