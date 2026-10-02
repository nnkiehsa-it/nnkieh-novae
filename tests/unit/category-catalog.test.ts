import { beforeEach, expect, it, vi } from "vitest";
import { clearCategoryCatalog, ensureCategoryCatalog, getImageUploadSettingsSnapshot, getPlatformFeaturesSnapshot, seedCategoryCatalog, seedImageUploadSettings } from "@/hooks/use-categories";
import { getCategoryCatalog } from "@/services/categories";
import type { CategoryCatalog } from "@/types/categories";

vi.mock("@/services/categories", () => ({ getCategoryCatalog: vi.fn() }));
const catalog = {
  features: { announcementCommentsEnabled: true, announcementMaxImages: 10, announcementCommentMaxImages: 1, facilitiesEnabled: true, issuesEnabled: true },
  facilityCategories: [], issueCategories: [],
  imageUploads: { maxDimension: 2000, maxUploadKilobytes: 800, webpQuality: 0.82 },
} as CategoryCatalog;
beforeEach(() => { clearCategoryCatalog(); vi.clearAllMocks(); });

it("preserves a canonical saved catalog when an earlier read fails", async () => {
  let reject!: (error: Error) => void;
  vi.mocked(getCategoryCatalog).mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
  const reading = ensureCategoryCatalog(true);
  seedCategoryCatalog({ ...catalog, features: { ...catalog.features, issuesEnabled: false } });
  reject(new Error("older refresh failed"));
  await expect(reading).resolves.toBeUndefined();
  expect(getPlatformFeaturesSnapshot().issuesEnabled).toBe(false);
});

it("keeps newly saved image processing settings when old streamed panels arrive", async () => {
  let complete!: () => void;
  vi.mocked(getCategoryCatalog).mockImplementationOnce((options) => new Promise((resolve) => {
    complete = () => { options?.onCatalog?.(catalog); resolve(catalog); };
  }));
  const reading = ensureCategoryCatalog(true);
  const saved = { ...catalog.imageUploads, maxDimension: 3000 };
  seedImageUploadSettings(saved);
  complete();
  await reading;
  expect(getImageUploadSettingsSnapshot()).toEqual(saved);
  expect(getPlatformFeaturesSnapshot()).toEqual(catalog.features);
});
