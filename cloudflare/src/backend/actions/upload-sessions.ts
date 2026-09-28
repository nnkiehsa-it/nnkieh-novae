import {
  CLOUDINARY_IMAGE_UPLOAD_PRESET, cloudinaryImageUploadUrl, createCloudinaryUploadSignature,
  getCloudinaryAuthenticatedImageMetadata, verifyCloudinaryUploadResponseSignature,
} from "../shared/cloudinary.ts";
import { requireEnv } from "../shared/env.ts";
import { asString } from "../shared/http.ts";
import { imageFitsUploadLimits, readCloudinaryImage } from "../shared/image-upload-validation.ts";
import { maxUploadBytes, type ImageUploadSettings } from "../shared/platform-settings.ts";
import type { Selected } from "../database/schema.ts";
import type { AuthContext, BackendDatabase, JsonRecord } from "./types.ts";
import { asNumber, asUuid } from "./utils.ts";

type FinalizedUpload = Selected<"uploads", "id" | "cloudinary_public_id" | "height" | "width">;
type StoredUpload = FinalizedUpload & Selected<"uploads", "status">;

export async function createUploadSessions(images: JsonRecord[], auth: AuthContext, database: BackendDatabase, settings: ImageUploadSettings) {
  const pending = images.map((image) => {
    const dimensions = { bytes: asNumber(image.size, 0), width: asNumber(image.width, 0), height: asNumber(image.height, 0) };
    if (asString(image.contentType) !== "image/webp" || !imageFitsUploadLimits(dimensions, settings)) throw new Error("upload-validation-failed");
    return { id: crypto.randomUUID(), size: Math.round(dimensions.bytes), width: Math.round(dimensions.width), height: Math.round(dimensions.height) };
  });
  const folder = `srp/${auth.uid}`;
  await database.sql`insert into app_private.uploads
    (id, owner_uid, cloudinary_public_id, status, visibility, width, height, size_bytes, content_type)
    select image.id, ${auth.uid}, ${folder} || '/' || image.id::text, 'pending', 'authenticated',
      image.width, image.height, image.size, 'image/webp'
    from jsonb_to_recordset(${JSON.stringify(pending)}::jsonb) as image(id uuid, width integer, height integer, size bigint)`;

  const timestamp = Math.floor(Date.now() / 1000);
  const notificationUrl = `${requireEnv("PUBLIC_API_URL").replace(/\/+$/u, "")}/v1/webhooks/cloudinary`;
  const cloudName = requireEnv("CLOUDINARY_CLOUD_NAME");
  const apiKey = requireEnv("CLOUDINARY_API_KEY");
  return Promise.all(pending.map(async (image) => {
    const params = {
      allowed_formats: "webp", folder, max_file_size: String(maxUploadBytes(settings)),
      notification_url: notificationUrl, overwrite: "false", public_id: image.id,
      timestamp: String(timestamp), type: "authenticated", upload_preset: CLOUDINARY_IMAGE_UPLOAD_PRESET,
    };
    return {
      apiKey, allowedFormats: params.allowed_formats, cloudName, folder,
      maxFileSize: params.max_file_size, notificationUrl, overwrite: params.overwrite,
      publicId: image.id, signature: await createCloudinaryUploadSignature(params), timestamp,
      type: params.type, uploadPreset: params.upload_preset, uploadUrl: cloudinaryImageUploadUrl(cloudName), uploadId: image.id,
    };
  }));
}

export async function finalizeUploadSessions(uploads: JsonRecord[], auth: AuthContext, database: BackendDatabase, settings: ImageUploadSettings) {
  const ids = uploads.map((upload) => asUuid(upload.uploadId).toLowerCase());
  if (ids.some((id) => !id)) throw new Error("not-found");
  const { rows } = await database.sql<StoredUpload>`
    select id, cloudinary_public_id, status, width, height from app_private.uploads
    where id = any(${ids}) and owner_uid = ${auth.uid}`;
  const byId = new Map(rows.map((upload) => [upload.id, upload]));
  // Reject the whole batch before contacting the provider when any record is unavailable.
  const stored = ids.map((id) => {
    const upload = byId.get(id);
    if (!upload) throw new Error("not-found");
    if (upload.status === "failed") throw new Error("upload-validation-failed");
    return upload;
  });
  const results = await Promise.allSettled(stored.map(async (upload, index) => {
    let data: FinalizedUpload = upload;
    if (upload.status === "pending") {
      const response = uploads[index];
      const publicId = asString(response.publicId);
      if (publicId !== upload.cloudinary_public_id || !await verifyCloudinaryUploadResponseSignature(
        publicId, Math.round(asNumber(response.version, 0)), asString(response.signature),
      )) throw new Error("upstream-invalid-response");
      const image = readCloudinaryImage(await getCloudinaryAuthenticatedImageMetadata(publicId), settings);
      if (!image.valid) throw new Error("upload-validation-failed");
      const finalized = await database.sqlMaybe<FinalizedUpload>`update app_private.uploads
        set height = ${image.height}, size_bytes = ${image.bytes}, status = 'ready', updated_at = now(), width = ${image.width}
        where id = ${upload.id} and owner_uid = ${auth.uid} and status = 'pending'
        returning id, cloudinary_public_id, height, width`;
      // The signed provider webhook may have finalized the same image while its metadata was loading.
      data = finalized ?? await database.sqlOne<FinalizedUpload>`
        select id, cloudinary_public_id, height, width from app_private.uploads
        where id = ${upload.id} and owner_uid = ${auth.uid} and status in ('ready', 'attached')`;
    }
    return { height: Number(data.height ?? 0), storagePath: data.cloudinary_public_id, uploadId: data.id, width: Number(data.width ?? 0) };
  }));
  // Keep the transaction alive until every provider read and SQL write has settled.
  const failure = results.find((result) => result.status === "rejected");
  if (failure) throw failure.reason;
  return results.filter((result) => result.status === "fulfilled").map((result) => result.value);
}

export async function deleteUploadSessions(storagePaths: string[], auth: AuthContext, database: BackendDatabase) {
  if (storagePaths.length === 0) return { deleted: 0, success: true };
  // Removing rows and scheduling their provider cleanup share the action transaction.
  const { rows } = await database.sql`with removed as (
    delete from app_private.uploads
    where owner_uid = ${auth.uid} and cloudinary_public_id = any(${storagePaths})
      and attached_target_id is null and attached_target_type is null
      and status in ('pending', 'ready', 'failed')
    returning id, cloudinary_public_id
  ) select app_api.enqueue_background_job(
    job_type => 'deletion', scope_id => removed.id::text,
    payload => jsonb_build_object('cloudinary_public_id', removed.cloudinary_public_id, 'target_id', removed.id, 'target_type', 'upload'),
    created_by => ${auth.uid}
  ) as job_id from removed`;
  return { deleted: rows.length, success: true };
}
