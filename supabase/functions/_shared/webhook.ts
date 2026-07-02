import { requireEnv } from "./env.ts";

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(left: string, right: string) {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  if (leftBytes.length !== rightBytes.length) return false;

  let diff = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    diff |= leftBytes[index] ^ rightBytes[index];
  }
  return diff === 0;
}

export function requireBearerSecret(request: Request, envName = "WEBHOOK_SECRET") {
  const expected = requireEnv(envName);
  const authorization = request.headers.get("authorization") ?? "";
  if (authorization !== `Bearer ${expected}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}

export async function verifyCloudinarySignature(request: Request, rawBody: string) {
  const secret = requireEnv("CLOUDINARY_WEBHOOK_SECRET");
  const signature = request.headers.get("x-cld-signature") ?? "";
  const timestamp = request.headers.get("x-cld-timestamp") ?? "";
  const timestampSeconds = Number(timestamp);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(timestampSeconds) || Math.abs(nowSeconds - timestampSeconds) > 60 * 60) {
    return new Response("Invalid timestamp", { status: 401 });
  }

  const digest = await crypto.subtle.digest(
    "SHA-1",
    new TextEncoder().encode(`${rawBody}${timestamp}${secret}`),
  );
  if (!timingSafeEqual(toHex(digest), signature)) {
    return new Response("Invalid signature", { status: 401 });
  }
  return null;
}
