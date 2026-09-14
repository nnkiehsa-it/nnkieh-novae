import { describe, expect, it } from "vitest";

import {
  realtimeHeartbeatInterval,
  realtimeIdleRemaining,
} from "@/lib/realtime-timing";
const REALTIME_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

describe("realtime timing policy", () => {
  it("pings well inside the idle window so a silent connection is noticed", () => {
    expect(realtimeHeartbeatInterval()).toBe(30_000);
    expect(realtimeHeartbeatInterval()).toBeLessThan(realtimeIdleRemaining(0, 0));
  });

  it("uses a thirty-minute inactivity window", () => {
    expect(realtimeIdleRemaining(0,0)).toBe(30 * 60 * 1_000);
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
