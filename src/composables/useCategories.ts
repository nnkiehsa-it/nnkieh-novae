import { computed, readonly, ref } from 'vue';
import { getCategoryCatalog } from '@/services/categories';
import type { FacilityCategoryConfig, IssueCategoryConfig, PlatformFeatures } from '@/types/categories';

const issueCategories = ref<IssueCategoryConfig[]>([]);
const facilityCategories = ref<FacilityCategoryConfig[]>([]);
const loading = ref(false);
const error = ref('');
const features = ref<PlatformFeatures>({ facilitiesEnabled: true, issuesEnabled: true });
const loaded = ref(false);
let loadPromise: Promise<void> | null = null;

function replaceCatalog(next: {
  features: PlatformFeatures;
  issueCategories: IssueCategoryConfig[];
  facilityCategories: FacilityCategoryConfig[];
}) {
  issueCategories.value = next.issueCategories.slice().sort((a, b) => a.sortOrder - b.sortOrder);
  facilityCategories.value = next.facilityCategories.slice().sort((a, b) => a.sortOrder - b.sortOrder);
  features.value = next.features;
  loaded.value = true;
}

export async function ensureCategoryCatalog(force = false) {
  if (!force && loaded.value) return;
  if (!force && loadPromise) return await loadPromise;
  loading.value = true;
  error.value = '';
  loadPromise = (async () => {
    try {
      replaceCatalog(await getCategoryCatalog());
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'common.loadFailed';
      throw caught;
    } finally {
      loading.value = false;
      loadPromise = null;
    }
  })();
  return await loadPromise;
}

export function clearCategoryCatalog() {
  issueCategories.value = [];
  facilityCategories.value = [];
  features.value = { facilitiesEnabled: true, issuesEnabled: true };
  loaded.value = false;
  error.value = '';
  loadPromise = null;
}

export function findIssueCategory(categoryId: string | null | undefined) {
  return issueCategories.value.find((category) => category.id === categoryId) ?? null;
}

export function findFacilityCategory(categoryId: string | null | undefined) {
  return facilityCategories.value.find((category) => category.id === categoryId) ?? null;
}

export function getDefaultIssueCategoryId() {
  const active = issueCategories.value.filter((category) => category.isActive);
  return active.find((category) => category.isDefault)?.id ?? active[0]?.id ?? '';
}

export function getDefaultFacilityCategoryId() {
  const active = facilityCategories.value.filter((category) => category.isActive);
  return active.find((category) => category.isDefault)?.id ?? active[0]?.id ?? '';
}

export function getIssueCategorySnapshot() {
  return issueCategories.value.slice();
}

export function getPlatformFeaturesSnapshot() {
  return { ...features.value };
}

export function useCategories() {
  return {
    error: readonly(error),
    facilitiesEnabled: computed(() => features.value.facilitiesEnabled),
    facilityCategories: readonly(facilityCategories),
    features: readonly(features),
    issuesEnabled: computed(() => features.value.issuesEnabled),
    issueCategories: readonly(issueCategories),
    loading: readonly(loading),
    activeFacilityCategories: computed(() => facilityCategories.value.filter((category) => category.isActive)),
    activeIssueCategories: computed(() => issueCategories.value.filter((category) => category.isActive)),
    refresh: () => ensureCategoryCatalog(true),
  };
}
