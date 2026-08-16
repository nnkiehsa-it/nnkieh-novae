"use client";

import { useSyncExternalStore } from "react";
import { getCategoryCatalog } from "@/services/categories";
import { fetchSessionBootstrap } from "@/services/session-bootstrap";
import type {
  FacilityCategoryConfig,
  IssueCategoryConfig,
  PlatformFeatures,
  ImageUploadSettings,
} from "@/types/categories";
import { RATE_LIMITS } from "@/generated/rate-limits";

interface CategoryState {
  error: string;
  facilityCategories: FacilityCategoryConfig[];
  features: PlatformFeatures;
  issueCategories: IssueCategoryConfig[];
  imageUploads: ImageUploadSettings;
  loaded: boolean;
  loading: boolean;
}

const defaultFeatures: PlatformFeatures = {
  announcementCommentsEnabled: true,
  facilitiesEnabled: true,
  issuesEnabled: true,
};

const defaultImageUploads: ImageUploadSettings = {
  announcementMaxImages: RATE_LIMITS.imageUploads.announcementMaxImages,
  commentMaxImages: RATE_LIMITS.imageUploads.commentMaxImages,
  facilityMaxImages: RATE_LIMITS.imageUploads.facilityMaxImages,
  issueMaxImages: RATE_LIMITS.imageUploads.issueMaxImages,
  maxDimension: RATE_LIMITS.imageCompression.maxDimension,
  maxSourceMegabytes: RATE_LIMITS.imageCompression.maxSourceMegabytes,
  maxUploadKilobytes: RATE_LIMITS.imageCompression.maxUploadKilobytes,
  webpQuality: RATE_LIMITS.imageCompression.webpQuality,
};

const listeners = new Set<() => void>();
const initialCategoryState: CategoryState = {
  error: "",
  facilityCategories: [],
  features: defaultFeatures,
  issueCategories: [],
  imageUploads: defaultImageUploads,
  loaded: false,
  loading: false,
};
let state: CategoryState = initialCategoryState;
let loadPromise: Promise<void> | null = null;

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function replaceCatalog(next: {
  features: PlatformFeatures;
  issueCategories: IssueCategoryConfig[];
  facilityCategories: FacilityCategoryConfig[];
  imageUploads: ImageUploadSettings;
}) {
  state = {
    ...state,
    facilityCategories: [...next.facilityCategories].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    ),
    features: { ...next.features },
    imageUploads: { ...next.imageUploads },
    issueCategories: [...next.issueCategories].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    ),
    loaded: true,
  };
  emit();
}

export function seedCategoryCatalog(next: {
  features: PlatformFeatures;
  issueCategories: IssueCategoryConfig[];
  facilityCategories: FacilityCategoryConfig[];
  imageUploads: ImageUploadSettings;
}) {
  replaceCatalog(next);
}

export async function ensureCategoryCatalog(force = false) {
  if (!force && state.loaded) return;
  if (!force && loadPromise) return await loadPromise;
  state = { ...state, error: "", loading: true };
  emit();
  loadPromise = (async () => {
    try {
      if (!force) {
        try {
          const bootstrap = await fetchSessionBootstrap();
          replaceCatalog(bootstrap.catalog);
          return;
        } catch {
          // Fall through to the dedicated catalog action.
        }
      }
      replaceCatalog(await getCategoryCatalog());
    } catch (error) {
      state = {
        ...state,
        error: error instanceof Error ? error.message : "common.loadFailed",
      };
      emit();
      throw error;
    } finally {
      state = { ...state, loading: false };
      loadPromise = null;
      emit();
    }
  })();
  return await loadPromise;
}

export function clearCategoryCatalog() {
  state = {
    error: "",
    facilityCategories: [],
    features: defaultFeatures,
    issueCategories: [],
    imageUploads: defaultImageUploads,
    loaded: false,
    loading: false,
  };
  loadPromise = null;
  emit();
}

export function findIssueCategory(categoryId: string | null | undefined) {
  return (
    state.issueCategories.find((category) => category.id === categoryId) ?? null
  );
}

export function findFacilityCategory(categoryId: string | null | undefined) {
  return (
    state.facilityCategories.find((category) => category.id === categoryId) ??
    null
  );
}

export function getDefaultIssueCategoryId() {
  return (
    state.issueCategories.find((category) => category.isDefault)?.id ??
    state.issueCategories[0]?.id ??
    ""
  );
}

export function getDefaultFacilityCategoryId() {
  return (
    state.facilityCategories.find((category) => category.isDefault)?.id ??
    state.facilityCategories[0]?.id ??
    ""
  );
}

export function getIssueCategorySnapshot() {
  return [...state.issueCategories];
}

export function getPlatformFeaturesSnapshot() {
  return { ...state.features };
}

export function getImageUploadSettingsSnapshot() {
  return { ...state.imageUploads };
}

export function useCategories() {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => state,
    () => initialCategoryState,
  );
  return {
    ...snapshot,
    activeFacilityCategories: snapshot.facilityCategories,
    activeIssueCategories: snapshot.issueCategories,
    announcementCommentsEnabled: snapshot.features.announcementCommentsEnabled,
    facilitiesEnabled: snapshot.features.facilitiesEnabled,
    issuesEnabled: snapshot.features.issuesEnabled,
    refresh: () => ensureCategoryCatalog(true),
  };
}
