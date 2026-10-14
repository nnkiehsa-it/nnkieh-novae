import type { FacilityCategoryConfig, IssueCategoryConfig } from "@/types/categories";
import { IMAGE_UPLOAD_LIMITS } from "@shared/rate-limits.ts";

const CATEGORY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export const newIssueCategory = (sortOrder: number): IssueCategoryConfig => ({
  maxImages: IMAGE_UPLOAD_LIMITS.issueMaxImages,
  commentMaxImages: IMAGE_UPLOAD_LIMITS.commentMaxImages,
  authorDeleteEnabled: false,
  authorVisible: true,
  commentsEnabled: true,
  id: "",
  isDefault: sortOrder === 0,
  label: "",
  readAccess: "school",
  sortOrder,
  supportDeadlineDays: null,
  supportEnabled: false,
  supportGoal: null,
});

export const newFacilityCategory = (sortOrder: number): FacilityCategoryConfig => ({
  maxImages: IMAGE_UPLOAD_LIMITS.facilityMaxImages,
  authorDeleteEnabled: false,
  id: "",
  isDefault: sortOrder === 0,
  label: "",
  sortOrder,
});

export function removeCategory<T extends { isDefault: boolean; sortOrder: number }>(
  values: T[],
  index: number,
) {
  const next = values.filter((_, currentIndex) => currentIndex !== index);
  const hasDefault = next.some((item) => item.isDefault);
  return next.map((item, sortOrder) => ({
    ...item,
    isDefault: hasDefault ? item.isDefault : sortOrder === 0,
    sortOrder,
  }));
}

export function hasValidCategoryIdentity(values: Array<{ id: string; label: string }>) {
  const ids = values.map((item) => item.id.trim());
  return values.length > 0
    && new Set(ids).size === ids.length
    && values.every((item) => CATEGORY_PATTERN.test(item.id.trim()) && item.label.trim().length >= 1 && item.label.trim().length <= 40);
}

export function validSupportCount(value: number | null) {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 2_147_483_647;
}
