const required = [
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "CLOUDINARY_CLOUD_NAME",
];

for (const name of required) {
  if (!process.env[name]?.trim()) {
    throw new Error(`${name} is required to reset Cloudinary resources.`);
  }
}

const apiKey = process.env.CLOUDINARY_API_KEY.trim();
const apiSecret = process.env.CLOUDINARY_API_SECRET.trim();
const cloudName = process.env.CLOUDINARY_CLOUD_NAME.trim();
const apiBaseUrl = (process.env.CLOUDINARY_API_BASE_URL?.trim() || "https://api.cloudinary.com")
  .replace(/\/$/u, "");
const authorization = `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`;
const resourceTypes = ["image", "video", "raw"];
const deliveryTypes = ["upload", "authenticated", "private"];

async function deleteResourceBatch(resourceType, deliveryType, nextCursor) {
  const query = new URLSearchParams({ all: "true", invalidate: "true" });
  if (nextCursor) query.set("next_cursor", nextCursor);
  const response = await fetch(
    `${apiBaseUrl}/v1_1/${encodeURIComponent(cloudName)}/resources/${resourceType}/${deliveryType}?${query}`,
    { method: "DELETE", headers: { Authorization: authorization } },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = typeof payload.error?.message === "string" ? payload.error.message : response.statusText;
    throw new Error(`Cloudinary reset failed for ${resourceType}/${deliveryType} (${response.status}): ${detail}`);
  }
  return payload;
}

let totalDeleted = 0;
for (const resourceType of resourceTypes) {
  for (const deliveryType of deliveryTypes) {
    let nextCursor;
    do {
      const payload = await deleteResourceBatch(resourceType, deliveryType, nextCursor);
      const deleted = payload.deleted && typeof payload.deleted === "object" ? Object.keys(payload.deleted) : [];
      totalDeleted += deleted.length;
      console.log(`${resourceType}/${deliveryType}: deleted ${deleted.length} resource(s).`);
      nextCursor = typeof payload.next_cursor === "string" ? payload.next_cursor : undefined;
    } while (nextCursor);
  }
}

console.log(`Deleted ${totalDeleted} Cloudinary resource(s).`);
