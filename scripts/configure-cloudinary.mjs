import { readFile } from "node:fs/promises";
import process from "node:process";
import { fileURLToPath } from "node:url";

const uploadPreset = "srp-secure-images";
const apiBaseUrl = (process.env.CLOUDINARY_API_BASE_URL?.trim() || "https://api.cloudinary.com")
  .replace(/\/+$/u, "");
const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

if (!cloudName) throw new Error("CLOUDINARY_CLOUD_NAME is required.");
if (!apiKey) throw new Error("CLOUDINARY_API_KEY is required.");
if (!apiSecret) throw new Error("CLOUDINARY_API_SECRET is required.");

const limitsPath = fileURLToPath(
  new URL("../config/rate-limits.config.json", import.meta.url),
);
const limits = JSON.parse(await readFile(limitsPath, "utf8"));
const maxUploadKilobytes = Number(limits.imageCompression?.maxUploadKilobytes);
if (!Number.isSafeInteger(maxUploadKilobytes) || maxUploadKilobytes <= 0) {
  throw new Error("imageCompression.maxUploadKilobytes must be a positive integer.");
}

const preset = new URLSearchParams({
  allowed_formats: "webp",
  max_file_size: String(maxUploadKilobytes * 1024),
  overwrite: "false",
  type: "authenticated",
  unsigned: "false",
});
const headers = {
  authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`,
  "content-type": "application/x-www-form-urlencoded",
};

async function responseError(operation, response) {
  const detail = (await response.text()).slice(0, 2_000);
  return new Error(`Cloudinary upload preset ${operation} failed (${response.status}): ${detail}`);
}

const update = await fetch(
  `${apiBaseUrl}/v1_1/${encodeURIComponent(cloudName)}/upload_presets/${uploadPreset}`,
  {
    body: preset,
    headers,
    method: "PUT",
    signal: AbortSignal.timeout(15_000),
  },
);

if (!update.ok && update.status !== 404) throw await responseError("update", update);
if (update.status === 404) {
  preset.set("name", uploadPreset);
  const create = await fetch(
    `${apiBaseUrl}/v1_1/${encodeURIComponent(cloudName)}/upload_presets`,
    {
      body: preset,
      headers,
      method: "POST",
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!create.ok && create.status !== 409) throw await responseError("creation", create);
}

console.log(`Configured Cloudinary upload preset ${uploadPreset}.`);
