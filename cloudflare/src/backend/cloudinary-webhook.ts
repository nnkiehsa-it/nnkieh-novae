import type { AppDatabaseClient } from "./database/client.ts";
import { errorStatus, publicErrorBody } from "./shared/http.ts";
import { createFunctionLogger } from "./shared/observability.ts";
import { loadPlatformSettings, maxUploadBytes } from "./shared/platform-settings.ts";

export async function handleCloudinaryWebhook(body: Uint8Array, database: AppDatabaseClient) {
  const log = createFunctionLogger("cloudinaryWebhook");
  try {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(new TextDecoder().decode(body)) as Record<string, unknown>;
    } catch {
      throw new Error("invalid-json");
    }
    const publicId = String(payload.public_id ?? "");
    if (!publicId) throw new Error("validation-required");
    const format = String(payload.format ?? "").toLowerCase();
    const resourceType = String(payload.resource_type ?? "");
    const deliveryType = String(payload.type ?? "");
    const bytes = Number(payload.bytes ?? 0);
    const width = Number(payload.width ?? 0);
    const height = Number(payload.height ?? 0);
    const { imageUploads } = await loadPlatformSettings(database);
    const validAsset = format === "webp"
      && resourceType === "image"
      && deliveryType === "authenticated"
      && bytes > 0
      && bytes <= maxUploadBytes(imageUploads)
      && width > 0
      && height > 0
      && width <= imageUploads.maxDimension
      && height <= imageUploads.maxDimension;

    const { error } = await database.table("app_private", "uploads")
      .update({
        status: validAsset ? "ready" : "failed",
        size_bytes: Number.isFinite(bytes) ? bytes : null,
        width: Number.isFinite(width) ? width : null,
        height: Number.isFinite(height) ? height : null,
        updated_at: new Date().toISOString(),
      })
      .eq("cloudinary_public_id", publicId)
      .eq("status", "pending");
    if (error) throw error;

    if (!validAsset) {
      const { error: deletionError } = await database.table("app_private", "deletion_jobs").insert({
        target_type: "upload",
        target_id: publicId,
        cloudinary_public_id: publicId,
      });
      if (deletionError && deletionError.code !== "23505") throw deletionError;
    }

    log.success("media-webhook.completed", {
      assetStatus: validAsset ? "ready" : "rejected",
      status: 200,
    });
    return Response.json({ ok: true });
  } catch (error) {
    const status = errorStatus(error);
    if (status >= 500) log.error("media-webhook.failed", error, { status });
    else log.warn("media-webhook.rejected", { status });
    return Response.json({ ok: false, error: publicErrorBody(error) }, { status });
  }
}
