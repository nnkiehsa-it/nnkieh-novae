import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

  it("closes while idle and resumes with a foreground resync", () => {
    const transport = readFileSync(
      resolve(process.cwd(), "src/services/realtime-transport.ts"),
      "utf8",
    );
    expect(transport).toMatch(/idleSuspended = true;\s*closeSocket\(\)/u);
    expect(transport).toContain("document.addEventListener('visibilitychange', handleVisibilityChange)");
    expect(transport).toContain("ensureRealtimeConnection()");
    expect(transport).toContain("resyncCallbacks.forEach((callback) => callback())");
  });

  it("keeps content realtime deploy-configurable without disabling notifications", () => {
    const contentHook = readFileSync(
      resolve(process.cwd(), "src/hooks/use-content-realtime.ts"),
      "utf8",
    );
    const verification = readFileSync(
      resolve(process.cwd(), "scripts/verify-integration.mjs"),
      "utf8",
    );

    expect(contentHook).toContain("NEXT_PUBLIC_CONTENT_REALTIME_ENABLED");
    expect(verification).toContain('NEXT_PUBLIC_CONTENT_REALTIME_ENABLED: e2e ? "false" : "true"');
    expect(contentHook).not.toContain("notifications");
  });
});
