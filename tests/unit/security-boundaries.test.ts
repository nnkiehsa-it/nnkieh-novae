import { describe, expect, it } from "vitest";
import {
  requireFirebaseAppCheck,
  validateFirebaseAppCheckClaims,
} from "../../cloudflare/src/app-check";
import { claimActionRateLimit } from "../../cloudflare/src/rate-limit";
import { validateTurnstileResult } from "../../cloudflare/src/turnstile";
import { createMediaDeliveryUrl } from "../../cloudflare/src/backend/shared/media-delivery";
import { withRuntimeEnvironment } from "../../cloudflare/src/backend/shared/env";
import type { Env } from "../../cloudflare/src/types";

function securityEnvironment(overrides: Partial<Env> = {}) {
  return {
    ALLOWED_ORIGINS: "https://app.school.example,https://preview.school.example",
    FIREBASE_APP_IDS: "1:123456789:web:allowed",
    FIREBASE_PROJECT_NUMBER: "123456789",
    MEDIA_SIGNING_SECRET: "unit-test-media-signing-secret-that-is-long-enough",
    PUBLIC_API_URL: "https://api.school.example",
    ...overrides,
  } as Env;
}

function decodeMediaPayload(url: string) {
  const encoded = new URL(url).pathname.split("/")[3]?.split(".")[0] ?? "";
  const base64 = encoded.replace(/-/gu, "+").replace(/_/gu, "/")
    .padEnd(Math.ceil(encoded.length / 4) * 4, "=");
  return JSON.parse(atob(base64)) as Record<string, unknown>;
}

describe("security boundaries", () => {
  it("requires App Check outside local tests and restricts tokens to configured app IDs", async () => {
    const env = securityEnvironment();
    await expect(requireFirebaseAppCheck(new Request("https://api.school.example"), env))
      .rejects.toThrow("app-check-failed");
    expect(validateFirebaseAppCheckClaims({ sub: "1:123456789:web:allowed" }, env))
      .toBe("1:123456789:web:allowed");
    expect(() => validateFirebaseAppCheckClaims({ sub: "1:123456789:web:other" }, env))
      .toThrow("app-check-failed");
  });

  it("binds Turnstile verification to the expected action and allowed hostname", () => {
    const env = securityEnvironment();
    expect(() => validateTurnstileResult({
      action: "auth_sync",
      hostname: "app.school.example",
      success: true,
    }, env, "auth_sync")).not.toThrow();
    expect(() => validateTurnstileResult({
      action: "different_action",
      hostname: "app.school.example",
      success: true,
    }, env, "auth_sync")).toThrow("turnstile-failed");
    expect(() => validateTurnstileResult({
      action: "auth_sync",
      hostname: "attacker.example",
      success: true,
    }, env, "auth_sync")).toThrow("turnstile-failed");
  });

  it("uses stable opaque native limiter keys per UID", async () => {
    const keys: string[] = [];
    const env = securityEnvironment({
      READ_RATE_LIMITER: {
        limit: async ({ key }) => {
          keys.push(key);
          return { success: true };
        },
      },
    });
    await claimActionRateLimit(env, "school-user-a", "getContentVersions");
    await claimActionRateLimit(env, "school-user-a", "getContentVersions");
    await claimActionRateLimit(env, "school-user-b", "getContentVersions");

    expect(keys[0]).toBe(keys[1]);
    expect(keys[0]).not.toBe(keys[2]);
    expect(keys[0]).not.toContain("school-user-a");
    expect(keys.every((key) => key.length === 43)).toBe(true);
  });

  it("signs media URLs with viewer-scoped keys without exposing the UID", async () => {
    const env = securityEnvironment();
    const [first, second] = await withRuntimeEnvironment(env, () => Promise.all([
      createMediaDeliveryUrl("srp/example", "thumbnail", false, "school-user-a"),
      createMediaDeliveryUrl("srp/example", "thumbnail", false, "school-user-b"),
    ]));
    const firstPayload = decodeMediaPayload(first.url);
    const secondPayload = decodeMediaPayload(second.url);

    expect(firstPayload.rateLimitKey).not.toBe(secondPayload.rateLimitKey);
    expect(first.url).not.toContain("school-user-a");
    expect(firstPayload.version).toBe(2);
  });
});
