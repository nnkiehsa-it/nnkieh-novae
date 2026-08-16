import { requireEnv } from "./env.ts";

export type MediaDeliveryVariant = "avatar" | "full" | "thumbnail";

interface MediaDeliveryPayload {
  expiresAt: number;
  private: boolean;
  publicId: string;
  rateLimitKey: string;
  version: 2;
}

const PRIVATE_MEDIA_LIFETIME_SECONDS = 15 * 60;
const PRIVATE_MEDIA_EXPIRY_BUCKET_SECONDS = 5 * 60;

function toUrlSafeBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/u, "");
}

function encodePayload(payload: MediaDeliveryPayload) {
  return toUrlSafeBase64(new TextEncoder().encode(JSON.stringify(payload)));
}

async function signPayload(encodedPayload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(requireEnv("MEDIA_SIGNING_SECRET")),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`novae-media-v2.${encodedPayload}`),
  );
  return toUrlSafeBase64(new Uint8Array(signature));
}

async function createRateLimitKey(identifier: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(requireEnv("MEDIA_SIGNING_SECRET")),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`novae-media-viewer-v1.${identifier}`),
  );
  return toUrlSafeBase64(new Uint8Array(signature));
}

function privateExpirySeconds() {
  const minimumExpiry = Math.floor(Date.now() / 1000) + PRIVATE_MEDIA_LIFETIME_SECONDS;
  return Math.ceil(minimumExpiry / PRIVATE_MEDIA_EXPIRY_BUCKET_SECONDS)
    * PRIVATE_MEDIA_EXPIRY_BUCKET_SECONDS;
}

export async function createMediaDeliveryUrl(
  publicId: string,
  variant: MediaDeliveryVariant,
  privateDelivery: boolean,
  rateLimitIdentifier: string,
) {
  const expiresAt = privateDelivery ? privateExpirySeconds() : 0;
  const encodedPayload = encodePayload({
    expiresAt,
    private: privateDelivery,
    publicId,
    rateLimitKey: await createRateLimitKey(rateLimitIdentifier),
    version: 2,
  });
  const signature = await signPayload(encodedPayload);
  const workerUrl = requireEnv("PUBLIC_API_URL").replace(/\/+$/u, "");
  return {
    expiresAtMs: expiresAt ? expiresAt * 1000 : Number.MAX_SAFE_INTEGER,
    url: `${workerUrl}/v1/media/${encodedPayload}.${signature}/${variant}`,
  };
}

export async function createMediaDeliveryUrls(
  publicId: string,
  privateDelivery: boolean,
  rateLimitIdentifier: string,
) {
  const [full, thumbnail] = await Promise.all([
    createMediaDeliveryUrl(publicId, "full", privateDelivery, rateLimitIdentifier),
    createMediaDeliveryUrl(publicId, "thumbnail", privateDelivery, rateLimitIdentifier),
  ]);
  return {
    expiresAtMs: Math.min(full.expiresAtMs, thumbnail.expiresAtMs),
    fullUrl: full.url,
    thumbnailUrl: thumbnail.url,
  };
}
