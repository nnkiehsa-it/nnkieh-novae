import * as v from "valibot";
import { action, Count, Success, Timestamp, Uuid } from "../contract.ts";

export const ImageUploadTargetType = v.picklist(
  ["announcement", "announcement_comment", "comment", "facility", "issue"],
  "validation-required",
);
export type ImageUploadTargetType = v.InferOutput<typeof ImageUploadTargetType>;

/**
 * What the images go on. The scope names the category for new content and the
 * parent for a comment; the image limit is read from it, never from the caller.
 */
const UploadTarget = { targetType: ImageUploadTargetType, scopeId: v.string() };

/** The signed parameters one image is uploaded to Cloudinary with. */
export const ImageUploadSession = v.object({
  uploadId: Uuid,
  apiKey: v.string(),
  allowedFormats: v.string(),
  cloudName: v.string(),
  folder: v.string(),
  maxFileSize: v.string(),
  notificationUrl: v.string(),
  overwrite: v.string(),
  publicId: v.string(),
  signature: v.string(),
  timestamp: v.number(),
  type: v.string(),
  uploadPreset: v.string(),
  uploadUrl: v.string(),
});
export type ImageUploadSession = v.InferOutput<typeof ImageUploadSession>;

/** An image the platform has checked and kept, ready to be attached. */
export const UploadedImage = v.object({ uploadId: Uuid, storagePath: v.string(), width: Count, height: Count });
export type UploadedImage = v.InferOutput<typeof UploadedImage>;

/** How one image reaches a reader, and until when the address works. */
export const ImageDelivery = v.object({
  fullUrl: v.string(),
  thumbnailUrl: v.string(),
  expiresAt: Timestamp,
  privateDelivery: v.boolean(),
});
export type ImageDelivery = v.InferOutput<typeof ImageDelivery>;

function batch<T extends v.GenericSchema>(item: T) {
  return v.pipe(v.array(item), v.minLength(1, "validation-required"));
}

export const UPLOAD_ACTIONS = {
  createImageUploadSessions: action({
    group: "upload-write",
    extraLimit: "imageUploadDaily",
    units: (input) => input.images.length,
    input: v.object({
      ...UploadTarget,
      images: batch(v.object({
        contentType: v.literal("image/webp", "upload-validation-failed"),
        size: v.number(),
        width: v.number(),
        height: v.number(),
      })),
    }),
    output: v.object({ sessions: v.array(ImageUploadSession) }),
  }),
  finalizeImageUploads: action({
    group: "upload-write",
    input: v.object({
      ...UploadTarget,
      // Cloudinary's signed answer proves a pending upload; one the provider's
      // webhook already checked needs only its id.
      uploads: batch(v.object({
        uploadId: v.pipe(v.string(), v.uuid("not-found")),
        publicId: v.optional(v.string()),
        signature: v.optional(v.string()),
        version: v.optional(v.number()),
      })),
    }),
    output: v.object({ uploads: v.array(UploadedImage) }),
  }),
  deleteUploadedImages: action({
    group: "upload-write",
    extraLimit: "destructiveWriteHourly",
    input: v.object({ storagePaths: v.pipe(v.array(v.pipe(v.string(), v.nonEmpty())), v.maxLength(50)) }),
    output: v.object({ ...Success.entries, deleted: Count }),
  }),
  resolveUploadImageUrls: action({
    group: "upload-resolve",
    input: v.object({ uploadIds: v.pipe(v.array(v.string()), v.maxLength(50)) }),
    output: v.object({ images: v.record(v.string(), ImageDelivery) }),
  }),
};
