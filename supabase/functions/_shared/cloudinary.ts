import { requireEnv } from "./env.ts";

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function sha1Hex(value: string) {
  return toHex(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(value)));
}

async function signCloudinaryParams(params: Record<string, string>) {
  const apiSecret = requireEnv("CLOUDINARY_API_SECRET");
  const payload = Object.entries(params)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return sha1Hex(`${payload}${apiSecret}`);
}

export async function createCloudinaryUploadSignature(params: Record<string, string>) {
  return signCloudinaryParams(params);
}

export async function deleteCloudinaryAsset(publicId: string) {
  const cloudName = requireEnv("CLOUDINARY_CLOUD_NAME");
  const apiKey = requireEnv("CLOUDINARY_API_KEY");
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const params = {
    public_id: publicId,
    timestamp,
  };
  const body = new URLSearchParams({
    ...params,
    api_key: apiKey,
    signature: await signCloudinaryParams(params),
  });
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );

  if (!response.ok) {
    throw new Error(`Cloudinary delete failed: ${response.status} ${await response.text()}`);
  }

  const result = await response.json();
  if (result.result !== "ok" && result.result !== "not found") {
    throw new Error(`Cloudinary delete returned ${String(result.result ?? "unknown")}`);
  }
}
