import { IMAGE_COMPRESSION } from "@shared/rate-limits.ts";
import type { PlatformSettings } from "@/types/categories";
import { retentionLabelKey } from "./retention-groups";

interface ImageField {
  key: keyof PlatformSettings["imageUploads"];
  labelKey: string;
  max: number;
  min: number;
  step?: number;
  unitKey?: string;
}

export const IMAGE_PROCESSING_FIELDS: readonly ImageField[] = [
  {
    key: "maxUploadKilobytes",
    labelKey: "ui.admin.imageUploadKilobytes",
    max: IMAGE_COMPRESSION.maxPlatformUploadKilobytes,
    min: 100,
    unitKey: "admin.unitKilobytes",
  },
  {
    key: "maxDimension",
    labelKey: "ui.admin.imageMaxDimension",
    max: 8_000,
    min: 256,
    unitKey: "admin.unitPixels",
  },
  { key: "webpQuality", labelKey: "ui.admin.imageWebpQuality", max: 0.95, min: 0.4, step: 0.01 },
];

/** Turns a draft's `group.field` key back into the label the reader saw. */
export function describeSettingKey(key: string) {
  const [group, field] = key.split(".");
  if (group === "retention" && field) return retentionLabelKey(field);
  return IMAGE_PROCESSING_FIELDS.find((entry) => entry.key === field)?.labelKey ?? key;
}
