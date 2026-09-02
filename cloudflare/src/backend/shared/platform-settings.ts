import { DATA_RETENTION } from "./data-retention.ts";
import { RATE_LIMITS } from "./rate-limits.ts";
import type { DatabaseSession } from "../database/client.ts";

const IMAGE_UPLOADS_KEY = "image_upload_settings";
const RETENTION_KEY = "data_retention_settings";
const MAX_IMAGES = 20;
const MAX_RETENTION_DAYS = 3650;

export interface ImageUploadSettings {
  announcementMaxImages: number;
  commentMaxImages: number;
  facilityMaxImages: number;
  issueMaxImages: number;
  maxDimension: number;
  maxUploadKilobytes: number;
  webpQuality: number;
}

type RetentionDefaults = typeof DATA_RETENTION;
export type DataRetentionSettings = {
  -readonly [Key in keyof RetentionDefaults]: RetentionDefaults[Key] extends boolean ? boolean : number;
};

export interface PlatformSettings {
  imageUploads: ImageUploadSettings;
  retention: DataRetentionSettings;
}

export type UploadTargetType = "announcement" | "announcement_comment" | "comment" | "facility" | "issue";

const defaultImageUploads: ImageUploadSettings = {
  announcementMaxImages: RATE_LIMITS.imageUploads.announcementMaxImages,
  commentMaxImages: RATE_LIMITS.imageUploads.commentMaxImages,
  facilityMaxImages: RATE_LIMITS.imageUploads.facilityMaxImages,
  issueMaxImages: RATE_LIMITS.imageUploads.issueMaxImages,
  maxDimension: RATE_LIMITS.imageCompression.maxDimension,
  maxUploadKilobytes: RATE_LIMITS.imageCompression.maxUploadKilobytes,
  webpQuality: RATE_LIMITS.imageCompression.webpQuality,
};

const defaultRetention = { ...DATA_RETENTION } as DataRetentionSettings;

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function positiveInteger(value: unknown, fallback: number, minimum: number, maximum: number) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isInteger(number) && number >= minimum && number <= maximum ? number : fallback;
}

function numberInRange(value: unknown, fallback: number, minimum: number, maximum: number) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum ? number : fallback;
}

function boolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function parseStoredValue(value: string | null | undefined) {
  if (!value) return {};
  try {
    return record(JSON.parse(value));
  } catch {
    return {};
  }
}

function normalizeImageUploads(value: unknown): ImageUploadSettings {
  const settings = record(value);
  return {
    announcementMaxImages: positiveInteger(settings.announcementMaxImages, defaultImageUploads.announcementMaxImages, 1, MAX_IMAGES),
    commentMaxImages: positiveInteger(settings.commentMaxImages, defaultImageUploads.commentMaxImages, 1, MAX_IMAGES),
    facilityMaxImages: positiveInteger(settings.facilityMaxImages, defaultImageUploads.facilityMaxImages, 1, MAX_IMAGES),
    issueMaxImages: positiveInteger(settings.issueMaxImages, defaultImageUploads.issueMaxImages, 1, MAX_IMAGES),
    maxDimension: positiveInteger(settings.maxDimension, defaultImageUploads.maxDimension, 256, 8000),
    maxUploadKilobytes: positiveInteger(
      settings.maxUploadKilobytes,
      defaultImageUploads.maxUploadKilobytes,
      100,
      RATE_LIMITS.imageCompression.maxPlatformUploadKilobytes,
    ),
    webpQuality: numberInRange(settings.webpQuality, defaultImageUploads.webpQuality, 0.4, 0.95),
  };
}

function normalizeRetention(value: unknown): DataRetentionSettings {
  const settings = record(value);
  return Object.fromEntries(Object.entries(defaultRetention).map(([key, fallback]) => [
    key,
    typeof fallback === "boolean"
      ? boolean(settings[key], fallback)
      : positiveInteger(
        settings[key],
        fallback,
        1,
        key.endsWith("Hours") ? 87_600 : MAX_RETENTION_DAYS,
      ),
  ])) as DataRetentionSettings;
}

export function platformSettingsFromInput(value: unknown): PlatformSettings {
  const input = record(value);
  if (!("imageUploads" in input) || !("retention" in input)) throw new Error("validation-required");
  const imageUploads = normalizeImageUploads(input.imageUploads);
  const retention = normalizeRetention(input.retention);
  const imageInput = record(input.imageUploads);
  const retentionInput = record(input.retention);
  if (
    Object.keys(imageUploads).some((key) => imageUploads[key as keyof ImageUploadSettings] !== imageInput[key])
    || Object.keys(retention).some((key) => retention[key as keyof DataRetentionSettings] !== retentionInput[key])
  ) {
    throw new Error("validation-required");
  }
  return { imageUploads, retention };
}

export async function loadPlatformSettings(database: DatabaseSession): Promise<PlatformSettings> {
  const { data, error } = await database.table("app_private", "runtime_settings")
    .select("key,value").in("key", [IMAGE_UPLOADS_KEY, RETENTION_KEY]);
  if (error) throw error;
  const values = new Map((data ?? []).map((entry) => [entry.key, entry.value]));
  return {
    imageUploads: normalizeImageUploads(parseStoredValue(typeof values.get(IMAGE_UPLOADS_KEY) === "string" ? values.get(IMAGE_UPLOADS_KEY) : null)),
    retention: normalizeRetention(parseStoredValue(typeof values.get(RETENTION_KEY) === "string" ? values.get(RETENTION_KEY) : null)),
  };
}

export function maxImagesForTarget(settings: ImageUploadSettings, targetType: UploadTargetType) {
  if (targetType === "issue") return settings.issueMaxImages;
  if (targetType === "facility") return settings.facilityMaxImages;
  if (targetType === "announcement") return settings.announcementMaxImages;
  return settings.commentMaxImages;
}

export function maxUploadBytes(settings: ImageUploadSettings) {
  return settings.maxUploadKilobytes * 1024;
}
