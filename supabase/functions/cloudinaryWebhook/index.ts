import { createDatabaseClient } from "../_shared/database-client.ts";
import {
  errorStatus,
  jsonResponse,
  MAX_WEBHOOK_BODY_BYTES,
  publicErrorBody,
  readRequestText,
  requireMethod,
  textResponse,
} from "../_shared/http.ts";
import { verifyCloudinarySignature } from "../_shared/webhook.ts";
import { RATE_LIMITS } from "../_shared/rate-limits.ts";
import { requireOriginSecret } from "../_shared/origin.ts";
import { createFunctionLogger } from "../_shared/observability.ts";

Deno.serve(async (request) => {
  const originFailure = requireOriginSecret(request);
  if (originFailure) return originFailure;
  const methodFailure = requireMethod(request, "POST");
  if (methodFailure) return methodFailure;

  const log = createFunctionLogger("cloudinaryWebhook");
  try {
    const rawBody = await readRequestText(request, MAX_WEBHOOK_BODY_BYTES);
    const signatureFailure = await verifyCloudinarySignature(request, rawBody);
    if (signatureFailure) return signatureFailure;

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      throw new Error("invalid-json");
    }
    const publicId = String(payload.public_id ?? "");
    if (!publicId) {
      return textResponse("Missing public_id", { status: 400 });
    }
    const format = String(payload.format ?? "").toLowerCase();
    const resourceType = String(payload.resource_type ?? "");
    const deliveryType = String(payload.type ?? "");
    const bytes = Number(payload.bytes ?? 0);
    const width = Number(payload.width ?? 0);
    const height = Number(payload.height ?? 0);
    const validAsset = format === "webp"
      && resourceType === "image"
      && deliveryType === "authenticated"
      && bytes > 0
      && bytes <= RATE_LIMITS.imageCompression.maxUploadBytes
      && width > 0
      && height > 0
      && width <= RATE_LIMITS.imageCompression.maxDimension
      && height <= RATE_LIMITS.imageCompression.maxDimension;

    const supabase = createDatabaseClient();
    const { error } = await supabase
      .schema("app_private")
      .from("uploads")
      .update({
        status: validAsset ? "ready" : "failed",
        size_bytes: Number.isFinite(bytes) ? bytes : null,
        width: Number.isFinite(width) ? width : null,
        height: Number.isFinite(height) ? height : null,
        updated_at: new Date().toISOString(),
      })
      .eq("cloudinary_public_id", publicId)
      .eq("status", "pending");

    if (error) {
      throw error;
    }
    if (!validAsset) {
      const { error: deletionError } = await supabase.schema("app_private").from("deletion_jobs").insert({
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
    return jsonResponse({ ok: true });
  } catch (error) {
    const status = errorStatus(error);
    if (status >= 500) log.error("media-webhook.failed", error, { status });
    else log.warn("media-webhook.rejected", { status });
    return jsonResponse({ ok: false, error: publicErrorBody(error) }, { status });
  }
});
