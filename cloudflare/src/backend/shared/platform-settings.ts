import * as v from "valibot";
import { DATA_RETENTION } from "../../../../shared/data-retention.ts";
import { IMAGE_COMPRESSION } from "../../../../shared/rate-limits.ts";
import { DataRetentionSettings, ImageUploadSettings, type PlatformSettings } from "../../../../shared/contracts/categories.ts";
import type { DatabaseSession } from "../database/client.ts";
import type { Selected } from "../database/schema.ts";

export type { ImageUploadSettings } from "../../../../shared/contracts/categories.ts";

const IMAGE_UPLOADS_KEY = "image_upload_settings";
const RETENTION_KEY = "data_retention_settings";

export type UploadTargetType = "announcement" | "announcement_comment" | "comment" | "facility" | "issue";

const DEFAULT_IMAGE_UPLOADS = {
  maxDimension: IMAGE_COMPRESSION.maxDimension,
  maxUploadKilobytes: IMAGE_COMPRESSION.maxUploadKilobytes,
  webpQuality: IMAGE_COMPRESSION.webpQuality,
};

/**
 * A stored setting over its defaults. A setting nobody has saved yet is the
 * default, and an entry added after the last save takes its default; a stored
 * value that breaks the contract is a fault, not something to paper over.
 */
function stored<T extends v.GenericSchema>(schema: T, defaults: object, value: string | null | undefined): v.InferOutput<T> {
  return v.parse(schema, { ...defaults, ...(value ? JSON.parse(value) as object : {}) });
}

export function platformSettingsFromStoredRows(rows: Selected<"runtime_settings", "key" | "value">[]): PlatformSettings {
  const values = new Map(rows.map((entry) => [entry.key, entry.value]));
  return {
    imageUploads: stored(ImageUploadSettings, DEFAULT_IMAGE_UPLOADS, values.get(IMAGE_UPLOADS_KEY)),
    retention: stored(DataRetentionSettings, DATA_RETENTION, values.get(RETENTION_KEY)),
  };
}

export async function loadPlatformSettings(database: DatabaseSession): Promise<PlatformSettings> {
  const { rows } = await database.sql<Selected<"runtime_settings", "key" | "value">>`
    select key, value from app_private.runtime_settings where key = any(${[IMAGE_UPLOADS_KEY, RETENTION_KEY]})`;
  return platformSettingsFromStoredRows(rows);
}

export async function loadImageUploadSettings(database: DatabaseSession): Promise<ImageUploadSettings> {
  const row = await database.sqlMaybe<Selected<"runtime_settings", "value">>`
    select value from app_private.runtime_settings where key = ${IMAGE_UPLOADS_KEY}`;
  return stored(ImageUploadSettings, DEFAULT_IMAGE_UPLOADS, row?.value);
}

export function maxUploadBytes(settings: ImageUploadSettings) {
  return settings.maxUploadKilobytes * 1024;
}
