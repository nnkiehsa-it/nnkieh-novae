import { createCloudinaryUploadSignature } from "../_shared/cloudinary.ts";
import { requireEnv } from "../_shared/env.ts";
import { asString } from "../_shared/http.ts";
import { RATE_LIMITS } from "../_shared/rate-limits.ts";
import { claimFixedWindowRateLimit } from "../_shared/upstash-rate-limit.ts";
import type { AuthContext, BackendSupabase, JsonRecord } from "./types.ts";
import { asNumber, taipeiDayWindow } from "./utils.ts";

export function isUploadAction(action: string) {
  return action === "createImageUploadSession"
    || action === "finalizeImageUpload"
    || action === "deleteUploadedImage"
    || action === "resolveUploadImageUrls";
}

export async function handleUploadAction(
  action: string,
  payload: JsonRecord,
  auth: AuthContext,
  supabase: BackendSupabase,
) {
  if (action === "createImageUploadSession") {
    await claimFixedWindowRateLimit(
      auth.uid,
      "image_upload.create",
      taipeiDayWindow(),
      RATE_LIMITS.imageUploadDaily,
    );
    const uploadId = crypto.randomUUID();
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `srp/${auth.uid}`;
    const publicId = uploadId;
    const params = { folder, public_id: publicId, timestamp: String(timestamp) };
    const { error } = await supabase.schema("app_private").from("uploads").insert({
      id: uploadId,
      owner_uid: auth.uid,
      cloudinary_public_id: `${folder}/${publicId}`,
      status: "pending",
      visibility: "authenticated",
      width: Math.round(asNumber(payload.width, 0)),
      height: Math.round(asNumber(payload.height, 0)),
      size_bytes: Math.round(asNumber(payload.size, 0)),
      content_type: asString(payload.contentType, "image/webp"),
    });
    if (error) throw error;
    return {
      apiKey: requireEnv("CLOUDINARY_API_KEY"),
      cloudName: requireEnv("CLOUDINARY_CLOUD_NAME"),
      folder,
      publicId,
      signature: await createCloudinaryUploadSignature(params),
      timestamp,
      uploadId,
    };
  }

  if (action === "finalizeImageUpload") {
    const uploadId = asString(payload.uploadId);
    const { data, error } = await supabase.schema("app_private").from("uploads")
      .update({ status: "ready", updated_at: new Date().toISOString() })
      .eq("id", uploadId)
      .eq("owner_uid", auth.uid)
      .select("*")
      .single();
    if (error) throw error;
    return {
      height: data.height ?? 0,
      storagePath: data.cloudinary_public_id,
      uploadId: data.id,
      width: data.width ?? 0,
    };
  }

  if (action === "deleteUploadedImage") {
    const storagePath = asString(payload.storagePath);
    const uploadId = asString(payload.uploadId);
    let query = supabase.schema("app_private").from("uploads").select("*").eq("owner_uid", auth.uid);
    query = uploadId ? query.eq("id", uploadId) : query.eq("cloudinary_public_id", storagePath);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    if (data) {
      const { error: jobError } = await supabase.schema("app_private").from("deletion_jobs").insert({
        target_type: "upload",
        target_id: data.id,
        cloudinary_public_id: data.cloudinary_public_id,
      });
      if (jobError) throw jobError;
      await supabase.schema("app_private").from("uploads").delete().eq("id", data.id);
    }
    return { success: true };
  }

  const uploadIds = Array.isArray(payload.uploadIds) ? payload.uploadIds.map((id) => asString(id)).filter(Boolean).slice(0, 50) : [];
  const { data, error } = await supabase.schema("app_private").from("uploads")
    .select("id,cloudinary_public_id")
    .in("id", uploadIds)
    .in("status", ["ready", "attached"]);
  if (error) throw error;
  const cloudName = requireEnv("CLOUDINARY_CLOUD_NAME");
  const expiresAtMs = Date.now() + 15 * 60 * 1000;
  return {
    errors: {},
    expiresAtByUploadId: Object.fromEntries((data ?? []).map((upload) => [upload.id, expiresAtMs])),
    expiresAtMs,
    urls: Object.fromEntries((data ?? []).map((upload) => [
      upload.id,
      `https://res.cloudinary.com/${cloudName}/image/upload/${upload.cloudinary_public_id}`,
    ])),
  };
}
