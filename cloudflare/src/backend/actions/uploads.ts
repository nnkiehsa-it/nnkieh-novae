import {
  createCloudinaryUploadSignature,
  CLOUDINARY_IMAGE_UPLOAD_PRESET,
  cloudinaryImageUploadUrl,
  getCloudinaryAuthenticatedImageMetadata,
  verifyCloudinaryUploadResponseSignature,
} from "../shared/cloudinary.ts";
import { requireEnv } from "../shared/env.ts";
import { asString } from "../shared/http.ts";
import {
  loadPlatformSettings,
  maxImagesForTarget,
  maxUploadBytes,
  type ImageUploadSettings,
  type UploadTargetType,
} from "../shared/platform-settings.ts";
import type { AuthContext, BackendDatabase, JsonRecord } from "./types.ts";
import { asNumber } from "./utils.ts";
import type { Selected } from "../database/schema.ts";
import { resolveUploadImageUrls } from "./upload-delivery.ts";

/** What a finished upload tells the caller: where the image lives and how big it is. */
type FinalizedUpload = Selected<"uploads", "id" | "cloudinary_public_id" | "height" | "width">;

const MARKDOWN_UPLOAD_ID_PATTERN = /srp-upload:\/\/([0-9a-fA-F-]{36})/gu;
const MARKDOWN_IMAGE_SOURCE_PATTERN = /!\[[^\]]*\]\((\S+?)(?:\s+["'][^"']*["'])?\)/gu;
function extractMarkdownUploadIds(content: string) {
  return [...new Set(
    [...content.matchAll(MARKDOWN_UPLOAD_ID_PATTERN)]
      .map((match) => match[1])
      .filter(Boolean),
  )];
}

function assertOnlyManagedMarkdownImages(content: string) {
  const sources = [...content.matchAll(MARKDOWN_IMAGE_SOURCE_PATTERN)].map((match) => match[1]);
  if (sources.some((source) => !source?.startsWith("srp-upload://"))) {
    throw new Error("validation-invalid");
  }
}

async function assertMarkdownUploadsAttachable(
  database: BackendDatabase,
  ownerUid: string,
  uploadIds: string[],
  targetType: UploadTargetType,
  targetId: string | null,
) {
  if (uploadIds.length === 0) return;
  const { imageUploads } = await loadPlatformSettings(database);
  const maxImages = maxImagesForTarget(imageUploads, targetType);
  if (uploadIds.length > maxImages) throw new Error("validation-too-many");

  const { rows: attachable } = await database.sql<Selected<
    "uploads", "id" | "owner_uid" | "status" | "attached_target_type" | "attached_target_id"
  >>`select id, owner_uid, status, attached_target_type, attached_target_id
     from app_private.uploads where id = any(${uploadIds}) order by id for update`;
  const validIds = new Set(attachable.filter((upload) =>
    (upload.status === "ready" || upload.status === "attached")
    && (targetId
      ? (
        (upload.attached_target_type === targetType && upload.attached_target_id === targetId)
        || (upload.owner_uid === ownerUid && !upload.attached_target_id)
      )
      : upload.owner_uid === ownerUid && !upload.attached_target_id)
  ).map((upload) => upload.id));
  if (validIds.size !== uploadIds.length) throw new Error("validation-invalid");
}

export function isUploadAction(action: string) {
  return action === "createImageUploadSessions"
    || action === "finalizeImageUploads"
    || action === "deleteUploadedImages"
    || action === "resolveUploadImageUrls";
}

export async function validateMarkdownUploadsBeforeCreate(
  database: BackendDatabase,
  ownerUid: string,
  content: string,
  targetType: "announcement" | "announcement_comment" | "comment" | "facility" | "issue",
) {
  assertOnlyManagedMarkdownImages(content);
  await assertMarkdownUploadsAttachable(
    database,
    ownerUid,
    extractMarkdownUploadIds(content),
    targetType,
    null,
  );
}

export async function validateMarkdownUploadsBeforeUpdate(
  database: BackendDatabase,
  ownerUid: string,
  content: string,
  targetType: "announcement" | "announcement_comment" | "comment" | "facility" | "issue",
  targetId: string,
) {
  assertOnlyManagedMarkdownImages(content);
  await assertMarkdownUploadsAttachable(
    database,
    ownerUid,
    extractMarkdownUploadIds(content),
    targetType,
    targetId,
  );
}

export async function handleUploadAction(
  action: string,
  payload: JsonRecord,
  auth: AuthContext,
  database: BackendDatabase,
): Promise<JsonRecord> {
  if (action === "createImageUploadSessions") {
    const targetType = uploadTargetType(payload.targetType);
    const { imageUploads } = await loadPlatformSettings(database);
    const images = Array.isArray(payload.images)
      ? payload.images.map((image) => image as JsonRecord)
      : [];
    if (images.length === 0 || images.length > maxImagesForTarget(imageUploads, targetType)) {
      throw new Error(images.length > 0 ? "validation-too-many" : "validation-required");
    }
    for (const image of images) {
      if (!hasValidUploadDimensions(image, imageUploads)) throw new Error("upload-validation-failed");
    }
    const sessions = await Promise.all(images.map((image) =>
      handleUploadAction("internal:create-upload-session", image, auth, database)
    ));
    return { sessions };
  }

  if (action === "finalizeImageUploads") {
    const targetType = uploadTargetType(payload.targetType);
    const { imageUploads } = await loadPlatformSettings(database);
    const uploads = Array.isArray(payload.uploads)
      ? payload.uploads.map((upload) => upload as JsonRecord)
      : [];
    if (uploads.length === 0 || uploads.length > maxImagesForTarget(imageUploads, targetType)) {
      throw new Error(uploads.length > 0 ? "validation-too-many" : "validation-required");
    }
    const finalized = await Promise.all(uploads.map((upload) =>
      handleUploadAction("internal:finalize-upload", upload, auth, database)
    ));
    return { uploads: finalized };
  }

  if (action === "deleteUploadedImages") {
    const storagePaths = Array.isArray(payload.storagePaths)
      ? [...new Set(payload.storagePaths.map((path) => asString(path)).filter(Boolean))].slice(0, 50)
      : [];
    if (storagePaths.length === 0) return { deleted: 0, success: true };
    // Delete and return the eligible rows atomically, before enqueueing their cleanup.
    // Attachment validation locks the same rows, so a concurrent attach cannot race this check.
    const { rows: uploads } = await database.sql<Selected<"uploads", "id" | "cloudinary_public_id">>`
      delete from app_private.uploads
      where owner_uid = ${auth.uid} and cloudinary_public_id = any(${storagePaths})
        and attached_target_id is null and attached_target_type is null
        and status in ('pending', 'ready', 'failed')
      returning id, cloudinary_public_id`;
    if (uploads.length > 0) {
      for (const upload of uploads) {
        const { error: jobError } = await database.call("app_api", "enqueue_background_job", {
          job_type: "deletion",
          scope_id: upload.id,
          payload: {
            cloudinary_public_id: upload.cloudinary_public_id,
            target_id: upload.id,
            target_type: "upload",
          },
          created_by: auth.uid,
        });
        if (jobError) throw jobError;
      }
    }
    return { deleted: uploads.length, success: true };
  }

  if (action === "internal:create-upload-session") {
    const uploadId = crypto.randomUUID();
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `srp/${auth.uid}`;
    const publicId = uploadId;
    const notificationUrl = `${requireEnv("PUBLIC_API_URL").replace(/\/+$/u, "")}/v1/webhooks/cloudinary`;
    const { imageUploads } = await loadPlatformSettings(database);
    const params = {
      allowed_formats: "webp",
      folder,
      max_file_size: String(maxUploadBytes(imageUploads)),
      notification_url: notificationUrl,
      overwrite: "false",
      public_id: publicId,
      timestamp: String(timestamp),
      type: "authenticated",
      upload_preset: CLOUDINARY_IMAGE_UPLOAD_PRESET,
    };
    await database.sql`
      insert into app_private.uploads
        (id, owner_uid, cloudinary_public_id, status, visibility, width, height, size_bytes, content_type)
      values (${uploadId}, ${auth.uid}, ${`${folder}/${publicId}`}, 'pending', 'authenticated',
        ${Math.round(asNumber(payload.width, 0))}, ${Math.round(asNumber(payload.height, 0))},
        ${Math.round(asNumber(payload.size, 0))}, ${asString(payload.contentType, "image/webp")})`;
    return {
      apiKey: requireEnv("CLOUDINARY_API_KEY"),
      allowedFormats: params.allowed_formats,
      cloudName: requireEnv("CLOUDINARY_CLOUD_NAME"),
      folder,
      maxFileSize: params.max_file_size,
      notificationUrl,
      overwrite: params.overwrite,
      publicId,
      signature: await createCloudinaryUploadSignature(params),
      timestamp,
      type: params.type,
      uploadPreset: params.upload_preset,
      uploadUrl: cloudinaryImageUploadUrl(requireEnv("CLOUDINARY_CLOUD_NAME")),
      uploadId,
    };
  }

  if (action === "internal:finalize-upload") {
    const uploadId = asString(payload.uploadId);
    const upload = await database.sqlMaybe<Selected<
      "uploads", "id" | "owner_uid" | "cloudinary_public_id" | "status" | "width" | "height" | "size_bytes"
    >>`select id, owner_uid, cloudinary_public_id, status, width, height, size_bytes
       from app_private.uploads where id = ${uploadId} and owner_uid = ${auth.uid}`;
    if (!upload) throw new Error("not-found");
    if (upload.status === "failed") throw new Error("upload-validation-failed");

    let data: FinalizedUpload = upload;
    if (upload.status !== "ready") {
      const responsePublicId = asString(payload.publicId);
      const responseSignature = asString(payload.signature);
      const responseVersion = Math.round(asNumber(payload.version, 0));
      if (
        responsePublicId !== upload.cloudinary_public_id
        || !await verifyCloudinaryUploadResponseSignature(responsePublicId, responseVersion, responseSignature)
      ) throw new Error("upstream-invalid-response");

      const metadata = await getCloudinaryAuthenticatedImageMetadata(responsePublicId);
      const bytes = Math.round(asNumber(metadata.bytes, 0));
      const width = Math.round(asNumber(metadata.width, 0));
      const height = Math.round(asNumber(metadata.height, 0));
      const { imageUploads } = await loadPlatformSettings(database);
      const validAsset = asString(metadata.format).toLowerCase() === "webp"
        && asString(metadata.resource_type) === "image"
        && asString(metadata.type) === "authenticated"
        && bytes > 0
        && bytes <= maxUploadBytes(imageUploads)
        && width > 0
        && height > 0
        && width <= imageUploads.maxDimension
        && height <= imageUploads.maxDimension;
      if (!validAsset) throw new Error("upload-validation-failed");

      const finalized = await database.sqlMaybe<FinalizedUpload>`
        update app_private.uploads
        set height = ${height}, size_bytes = ${bytes}, status = 'ready',
          updated_at = ${new Date().toISOString()}, width = ${width}
        where id = ${uploadId} and owner_uid = ${auth.uid} and status = 'pending'
        returning id, cloudinary_public_id, height, width`;
      data = finalized ?? await database.sqlOne<FinalizedUpload>`
        select id, cloudinary_public_id, height, width from app_private.uploads
        where id = ${uploadId} and owner_uid = ${auth.uid} and status = 'ready'`;
    }
    return {
      height: Number(data.height ?? 0),
      storagePath: data.cloudinary_public_id,
      uploadId: data.id,
      width: Number(data.width ?? 0),
    };
  }

  return await resolveUploadImageUrls(payload, auth, database);
}

function uploadTargetType(value: unknown): UploadTargetType {
  const targetType = asString(value);
  if (
    targetType !== "issue"
    && targetType !== "facility"
    && targetType !== "announcement"
    && targetType !== "comment"
    && targetType !== "announcement_comment"
  ) throw new Error("validation-required");
  return targetType;
}

function hasValidUploadDimensions(image: JsonRecord, settings: ImageUploadSettings) {
  return asString(image.contentType) === "image/webp"
    && asNumber(image.size, 0) > 0
    && asNumber(image.size, 0) <= maxUploadBytes(settings)
    && asNumber(image.width, 0) > 0
    && asNumber(image.width, 0) <= settings.maxDimension
    && asNumber(image.height, 0) > 0
    && asNumber(image.height, 0) <= settings.maxDimension;
}
