import { describe, expect, it } from "vitest";

import {
  REALTIME_IDLE_TIMEOUT_MS,
  realtimeIdleRemaining,
} from "@/lib/realtime-idle";

describe("realtime idle policy", () => {
  it("uses a thirty-minute inactivity window", () => {
    expect(REALTIME_IDLE_TIMEOUT_MS).toBe(30 * 60 * 1_000);
  });

  it("returns the remaining window and reaches zero after the deadline", () => {
    const startedAt = 1_000;
    expect(realtimeIdleRemaining(startedAt, startedAt + 12_000)).toBe(
      REALTIME_IDLE_TIMEOUT_MS - 12_000,
    );
    expect(
      realtimeIdleRemaining(startedAt, startedAt + REALTIME_IDLE_TIMEOUT_MS),
    ).toBe(0);
    expect(
      realtimeIdleRemaining(startedAt, startedAt + REALTIME_IDLE_TIMEOUT_MS + 1),
    ).toBe(0);
  });
});
