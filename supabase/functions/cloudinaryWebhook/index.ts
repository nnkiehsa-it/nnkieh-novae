import { createClient } from "npm:@supabase/supabase-js@2";
import type { Database } from "../_shared/database.ts";
import { requireEnv } from "../_shared/env.ts";
import { errorMessage, errorStatus, jsonResponse, publicError, requireMethod, textResponse } from "../_shared/http.ts";
import { verifyCloudinarySignature } from "../_shared/webhook.ts";
import { RATE_LIMITS } from "../_shared/rate-limits.ts";
import { claimFixedWindowRateLimit, utcMinuteWindow, utcSecondWindow } from "../_shared/upstash-rate-limit.ts";

Deno.serve(async (request) => {
  const methodFailure = requireMethod(request, "POST");
  if (methodFailure) return methodFailure;

  try {
    const rawBody = await request.text();
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
    await claimFixedWindowRateLimit(
      "global",
      "cloudinary.webhook.second",
      utcSecondWindow(),
      RATE_LIMITS.cloudinaryWebhookSecond,
    );
    await claimFixedWindowRateLimit(
      "global",
      "cloudinary.webhook",
      utcMinuteWindow(),
      RATE_LIMITS.cloudinaryWebhookMinute,
    );
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

    const supabase = createClient<Database>(
      requireEnv("SUPABASE_URL"),
      requireEnv("APP_SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false } },
    );
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
      if (deletionError) throw deletionError;
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    console.error(errorMessage(error));
    return jsonResponse({ ok: false, error: publicError(error) }, { status: errorStatus(error) });
  }
});
