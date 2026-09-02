import {
  createCloudinaryUploadSignature,
  CLOUDINARY_IMAGE_UPLOAD_PRESET,
  cloudinaryImageUploadUrl,
  getCloudinaryAuthenticatedImageMetadata,
  verifyCloudinaryUploadResponseSignature,
} from "../shared/cloudinary.ts";
import { createMediaDeliveryUrls } from "../shared/media-delivery.ts";
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
import { canReadIssue } from "./issue-shared.ts";

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

  const { data: attachable, error: attachableError } = await database.table("app_private", "uploads")
    .select("id,owner_uid,status,attached_target_type,attached_target_id")
    .in("id", uploadIds);
  if (attachableError) throw attachableError;
  const validIds = new Set((attachable ?? []).filter((upload: any) =>
    (upload.status === "ready" || upload.status === "attached")
    && (targetId
      ? (
        (upload.attached_target_type === targetType && upload.attached_target_id === targetId)
        || (upload.owner_uid === ownerUid && !upload.attached_target_id)
      )
      : upload.owner_uid === ownerUid && !upload.attached_target_id)
  ).map((upload: any) => upload.id));
  if (validIds.size !== uploadIds.length) throw new Error("validation-invalid");
}

function issueDeliveryAccess(
  issue: JsonRecord | undefined,
  auth: AuthContext,
) {
  if (!issue) return { allowed: false, privateDelivery: true };
  return {
    allowed: canReadIssue(issue, auth),
    privateDelivery: issue.read_access === "owner-admin"
      || (issue.read_access === "reviewed-school"
        && ["under-review", "review-rejected"].includes(asString(issue.status))),
  };
}

async function resolveUploadAccessBatch(
  uploads: JsonRecord[],
  auth: AuthContext,
  database: BackendDatabase,
) {
  const issueIds = new Set<string>();
  const commentIds = new Set<string>();
  for (const upload of uploads) {
    const type = asString(upload.attached_target_type);
    const id = asString(upload.attached_target_id);
    if (type === "issue" && id) issueIds.add(id);
    if (type === "comment" && id) commentIds.add(id);
  }
  const commentToIssue = new Map<string, string>();
  if (commentIds.size > 0) {
    const { data, error } = await database.table("app_private", "comments")
      .select("id,issue_id").in("id", [...commentIds]);
    if (error) throw error;
    for (const comment of data ?? []) {
      commentToIssue.set(String(comment.id), String(comment.issue_id));
      issueIds.add(String(comment.issue_id));
    }
  }
  const issues = new Map<string, JsonRecord>();
  const facilityIds = uploads.filter((upload) => asString(upload.attached_target_type) === "facility")
    .map((upload) => asString(upload.attached_target_id)).filter(Boolean);
  const availableFacilities = new Set<string>();
  if (facilityIds.length > 0) {
    const { data, error } = await database.table("app_private", "facility_reports").select("id").in("id", facilityIds);
    if (error) throw error;
    for (const facility of data ?? []) availableFacilities.add(String(facility.id));
  }
  if (issueIds.size > 0) {
    const { data, error } = await database.table("app_private", "issues")
      .select("id,category,status,author_uid,read_access,author_visible").in("id", [...issueIds]);
    if (error) throw error;
    for (const issue of data ?? []) issues.set(String(issue.id), issue as JsonRecord);
  }
  return new Map(uploads.map((upload) => {
    const targetType = asString(upload.attached_target_type);
    const targetId = asString(upload.attached_target_id);
    if (!targetType || !targetId) {
      return [asString(upload.id), { allowed: asString(upload.owner_uid) === auth.uid, privateDelivery: true }];
    }
    if (targetType === "issue") {
      return [asString(upload.id), issueDeliveryAccess(issues.get(targetId), auth)];
    }
    if (targetType === "comment") {
      return [asString(upload.id), issueDeliveryAccess(issues.get(commentToIssue.get(targetId) ?? ""), auth)];
    }
    if (targetType === "announcement" || targetType === "announcement_comment") {
      return [asString(upload.id), { allowed: true, privateDelivery: false }];
    }
    if (targetType === "facility") {
      return [asString(upload.id), { allowed: availableFacilities.has(targetId), privateDelivery: false }];
    }
    return [asString(upload.id), { allowed: false, privateDelivery: true }];
  }));
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
    const { data, error } = await database.table("app_private", "uploads")
      .select("id,cloudinary_public_id")
      .eq("owner_uid", auth.uid)
      .in("cloudinary_public_id", storagePaths);
    if (error) throw error;
    const uploads = data ?? [];
    if (uploads.length > 0) {
      for (const upload of uploads as Array<{ cloudinary_public_id: string; id: string }>) {
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
      const { error: deleteError } = await database.table("app_private", "uploads")
        .delete().in("id", uploads.map((upload: any) => upload.id));
      if (deleteError) throw deleteError;
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
    const { error } = await database.table("app_private", "uploads").insert({
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
    const { data: upload, error: uploadError } = await database.table("app_private", "uploads")
      .select("id,owner_uid,cloudinary_public_id,status,width,height,size_bytes")
      .eq("id", uploadId)
      .eq("owner_uid", auth.uid)
      .maybeSingle();
    if (uploadError) throw uploadError;
    if (!upload) throw new Error("not-found");
    if (upload.status === "failed") throw new Error("upload-validation-failed");

    let data = upload as JsonRecord;
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

      const { data: finalized, error: finalizeError } = await database.table("app_private", "uploads")
        .update({
          height,
          size_bytes: bytes,
          status: "ready",
          updated_at: new Date().toISOString(),
          width,
        })
        .eq("id", uploadId)
        .eq("owner_uid", auth.uid)
        .eq("status", "pending")
        .select("id,cloudinary_public_id,height,width")
        .maybeSingle();
      if (finalizeError) throw finalizeError;
      if (finalized) {
        data = finalized as JsonRecord;
      } else {
        const { data: webhookFinalized, error: webhookError } = await database.table("app_private", "uploads")
          .select("id,cloudinary_public_id,height,width")
          .eq("id", uploadId)
          .eq("owner_uid", auth.uid)
          .eq("status", "ready")
          .single();
        if (webhookError) throw webhookError;
        data = webhookFinalized as JsonRecord;
      }
    }
    return {
      height: Number(data.height ?? 0),
      storagePath: data.cloudinary_public_id,
      uploadId: data.id,
      width: Number(data.width ?? 0),
    };
  }

  const uploadIds = Array.isArray(payload.uploadIds) ? payload.uploadIds.map((id) => asString(id)).filter(Boolean).slice(0, 50) : [];
  const { data, error } = await database.table("app_private", "uploads")
    .select("id,owner_uid,cloudinary_public_id,attached_target_type,attached_target_id")
    .in("id", uploadIds)
    .in("status", ["ready", "attached"]);
  if (error) throw error;
  const accessByUploadId = await resolveUploadAccessBatch((data ?? []) as JsonRecord[], auth, database);
  const resolved = await Promise.all((data ?? []).map(async (upload: any) => {
    const access = accessByUploadId.get(upload.id) ?? { allowed: false, privateDelivery: true };
    if (!access.allowed || !upload.cloudinary_public_id) return null;
    return {
      id: upload.id,
      ...await createMediaDeliveryUrls(upload.cloudinary_public_id, access.privateDelivery, auth.uid),
    };
  }));
  const available = resolved.filter((entry: any): entry is NonNullable<typeof entry> => Boolean(entry));
  const expiresAtMs = available.length
    ? Math.min(...available.map((entry: any) => entry.expiresAtMs))
    : Date.now();
  return {
    errors: Object.fromEntries(uploadIds.filter((id) => !available.some((entry: any) => entry.id === id)).map((id) => [id, "not-found"])),
    expiresAt: new Date(expiresAtMs).toISOString(),
    expiresAtByUploadId: Object.fromEntries(available.map((entry: any) => [entry.id, new Date(entry.expiresAtMs).toISOString()])),
    fullUrls: Object.fromEntries(available.map((entry: any) => [entry.id, entry.fullUrl])),
    thumbnailUrls: Object.fromEntries(available.map((entry: any) => [entry.id, entry.thumbnailUrl])),
  };
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
