import { RATE_LIMITS } from "@/generated/rate-limits";
import { retentionLabelKey } from "@/components/admin/retention-groups";
import type { PlatformSettings } from "@/types/categories";

export interface ImageField {
  key: keyof PlatformSettings["imageUploads"];
  labelKey: string;
  max: number;
  min: number;
  step?: number;
  unitKey?: string;
}

export const IMAGE_COUNT_FIELDS: readonly ImageField[] = [
  { key: "issueMaxImages", labelKey: "ui.admin.issueImageLimit", max: 20, min: 1 },
  { key: "facilityMaxImages", labelKey: "ui.admin.facilityImageLimit", max: 20, min: 1 },
  { key: "announcementMaxImages", labelKey: "ui.admin.announcementImageLimit", max: 20, min: 1 },
  { key: "commentMaxImages", labelKey: "ui.admin.commentImageLimit", max: 20, min: 1 },
];

export const IMAGE_PROCESSING_FIELDS: readonly ImageField[] = [
  {
    key: "maxUploadKilobytes",
    labelKey: "ui.admin.imageUploadKilobytes",
    max: RATE_LIMITS.imageCompression.maxPlatformUploadKilobytes,
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

export const IMAGE_FIELDS: readonly ImageField[] = [...IMAGE_COUNT_FIELDS, ...IMAGE_PROCESSING_FIELDS];

/** Turns a draft's `group.field` key back into the label the reader saw. */
export function describeSettingKey(key: string) {
  const [group, field] = key.split(".");
  if (group === "retention" && field) return retentionLabelKey(field);
  const image = IMAGE_FIELDS.find((entry) => entry.key === field);
  return image ? image.labelKey : key;
}
