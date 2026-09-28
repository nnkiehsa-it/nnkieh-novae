import type { AppDatabaseClient } from "./database/client.ts";
import { errorStatus, publicErrorBody } from "./shared/http.ts";
import { createFunctionLogger } from "./shared/observability.ts";
import { loadImageUploadSettings } from "./shared/platform-settings.ts";
import { readCloudinaryImage } from "./shared/image-upload-validation.ts";

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
    const settings = await loadImageUploadSettings(database);
    const { bytes, width, height, valid: validAsset } = readCloudinaryImage(payload, settings);

    const orphaned = await database.transaction(async (tx) => {
      const updated = await tx.sql`update app_private.uploads set
        status = ${validAsset ? "ready" : "failed"},
        size_bytes = ${Number.isSafeInteger(bytes) && bytes >= 0 ? bytes : null},
        width = ${Number.isSafeInteger(width) && width >= 0 ? width : null},
        height = ${Number.isSafeInteger(height) && height >= 0 ? height : null},
        updated_at = ${new Date().toISOString()}
        where cloudinary_public_id = ${publicId} and status = 'pending' returning id`;
      const tracked = updated.rows.length > 0 || Boolean(await tx.sqlMaybe`
        select id from app_private.uploads where cloudinary_public_id = ${publicId}`);
      // A canceled or failed batch can be cleaned up before the provider finishes uploading.
      const orphaned = !tracked && publicId.startsWith("srp/");

      if (!validAsset || orphaned) {
        const { error: deletionError } = await tx.call("app_api", "enqueue_background_job", {
          job_type: "deletion",
          scope_id: publicId,
          payload: {
            cloudinary_public_id: publicId,
            target_id: publicId,
            target_type: "upload",
          },
          created_by: "cloudinary-webhook",
        });
        if (deletionError) throw deletionError;
      }
      return orphaned;
    });

    log.success("media-webhook.completed", {
      assetStatus: orphaned ? "removed" : validAsset ? "ready" : "rejected",
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
