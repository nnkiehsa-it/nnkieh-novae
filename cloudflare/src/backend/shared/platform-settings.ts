import { DATA_RETENTION } from "./data-retention.ts";
import { RATE_LIMITS } from "./rate-limits.ts";
import type { AppDatabaseClient } from "../database/client.ts";

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

export interface ClosedContentRetentionSettings {
  closedFacilitiesDays: number;
  closedFacilitiesEnabled: boolean;
  closedIssuesDays: number;
  closedIssuesEnabled: boolean;
}

export interface PlatformSettings {
  imageUploads: ImageUploadSettings;
  retention: ClosedContentRetentionSettings;
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

const defaultRetention: ClosedContentRetentionSettings = {
  closedFacilitiesDays: DATA_RETENTION.closedFacilitiesDays,
  closedFacilitiesEnabled: Boolean(DATA_RETENTION.closedFacilitiesEnabled),
  closedIssuesDays: DATA_RETENTION.closedIssuesDays,
  closedIssuesEnabled: Boolean(DATA_RETENTION.closedIssuesEnabled),
};

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

function normalizeRetention(value: unknown): ClosedContentRetentionSettings {
  const settings = record(value);
  return {
    closedFacilitiesDays: positiveInteger(settings.closedFacilitiesDays, defaultRetention.closedFacilitiesDays, 1, MAX_RETENTION_DAYS),
    closedFacilitiesEnabled: boolean(settings.closedFacilitiesEnabled, defaultRetention.closedFacilitiesEnabled),
    closedIssuesDays: positiveInteger(settings.closedIssuesDays, defaultRetention.closedIssuesDays, 1, MAX_RETENTION_DAYS),
    closedIssuesEnabled: boolean(settings.closedIssuesEnabled, defaultRetention.closedIssuesEnabled),
  };
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
    || Object.keys(retention).some((key) => retention[key as keyof ClosedContentRetentionSettings] !== retentionInput[key])
  ) {
    throw new Error("validation-required");
  }
  return { imageUploads, retention };
}

export async function loadPlatformSettings(database: AppDatabaseClient): Promise<PlatformSettings> {
  const { data, error } = await database.table("app_private", "runtime_settings")
    .select("key,value").in("key", [IMAGE_UPLOADS_KEY, RETENTION_KEY]);
  if (error) throw error;
  const values = new Map((data ?? []).map((entry) => [entry.key, entry.value]));
  return {
    imageUploads: normalizeImageUploads(parseStoredValue(values.get(IMAGE_UPLOADS_KEY))),
    retention: normalizeRetention(parseStoredValue(values.get(RETENTION_KEY))),
  };
}

export async function savePlatformSettings(database: AppDatabaseClient, settings: PlatformSettings) {
  const { error } = await database.table("app_private", "runtime_settings").upsert([
    { key: IMAGE_UPLOADS_KEY, value: JSON.stringify(settings.imageUploads), updated_at: new Date().toISOString() },
    { key: RETENTION_KEY, value: JSON.stringify(settings.retention), updated_at: new Date().toISOString() },
  ], { onConflict: "key" });
  if (error) throw error;
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
