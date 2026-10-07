import { afterEach, expect, it, vi } from "vitest";
import { handleMedia } from "../../cloudflare/src/media";
import { createMediaDeliveryUrl } from "../../cloudflare/src/backend/shared/media-delivery";
import { withRuntimeEnvironment } from "../../cloudflare/src/backend/shared/env";
import { DEFAULT_OPERATION_POLICIES } from "../../cloudflare/generated/operations";
import type { Env } from "../../cloudflare/src/types";

vi.mock("../../cloudflare/src/media-policies", () => ({
  mediaPolicies: async () => ({ revision: 1, values: DEFAULT_OPERATION_POLICIES }),
}));
afterEach(() => vi.unstubAllGlobals());
const env = {
  MEDIA_SIGNING_SECRET: "media-test-signing-secret",
  PUBLIC_API_URL: "https://api.school.example",
  CLOUDINARY_CLOUD_NAME: "test", CLOUDINARY_API_SECRET: "test",
  LOCAL_TEST_MODE: "true", LOCAL_TEST_DISABLE_RATE_LIMITS: "true",
} as Env;

it("caches versioned avatars immutably and returns before the edge cache write finishes", async () => {
  const put = vi.fn(() => new Promise<void>(() => {}));
  vi.stubGlobal("caches", { default: { match: async () => undefined, put } });
  vi.stubGlobal("fetch", vi.fn(async () => new Response("image", { headers: { "content-type": "image/webp" } })));
  const media = await withRuntimeEnvironment(env, () => createMediaDeliveryUrl("srp/avatars/versioned", "avatar", false, "user"));
  const token = new URL(media.url).pathname.split("/")[3]!;
  const waitUntil = vi.fn();
  const response = await handleMedia(new Request(media.url), env, token, "avatar", { waitUntil });
  expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
  expect(put).toHaveBeenCalledOnce();
  expect(waitUntil).toHaveBeenCalledOnce();
  expect(await response.text()).toBe("image");
});

it("retains private no-store and public attachment revalidation on edge hits", async () => {
  vi.stubGlobal("caches", { default: { match: async () => new Response("image") } });
  for (const privateDelivery of [true, false]) {
    const media = await withRuntimeEnvironment(env, () => createMediaDeliveryUrl("srp/attachments/id", "full", privateDelivery, "user"));
    const token = new URL(media.url).pathname.split("/")[3]!;
    const response = await handleMedia(new Request(media.url), env, token, "full", { waitUntil: vi.fn() });
    expect(response.headers.get("cache-control")).toBe(privateDelivery ? "private, no-store" : "public, max-age=60, must-revalidate");
  }
});
