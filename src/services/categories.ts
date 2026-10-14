import type { ActionRequest } from '@shared/actions.ts';
import { callAction } from '@/services/backend-action';
import { markSessionBootstrapStale } from '@/services/session';
import type { CategoryCatalog, FacilityCategoryConfig, IssueCategoryConfig, PlatformSettings } from '@/types/categories';

export type { PlatformJob } from '@shared/contracts/categories.ts';

/** The catalog as the admin screen edits it: whole category records, in display order. */
export type CategoryManagementInput = Omit<ActionRequest<'saveCategoryManagement'>, 'revision' | 'issueCategories' | 'facilityCategories'> & {
  issueCategories: IssueCategoryConfig[];
  facilityCategories: FacilityCategoryConfig[];
};

export async function getCategoryCatalog(
  options: { onCatalog?: (catalog: Partial<CategoryCatalog>) => void } = {},
) {
  return await callAction('getCategoryCatalog', {}, {
    onSegment: (key, data) => {
      if (key) options.onCatalog?.({ [key]: data } as Partial<CategoryCatalog>);
    },
  });
}

export async function getCategoryManagement() {
  return await callAction('getCategoryManagement', {});
}

export async function completeInitialSetup(input: ActionRequest<'completeInitialSetup'>) {
  return await callAction('completeInitialSetup', input);
}

export async function saveCategoryManagement(input: CategoryManagementInput, revision: string) {
  const result = await callAction('saveCategoryManagement', { ...input, revision });
  markSessionBootstrapStale();
  return result;
}

export async function estimateCategoryPolicyChanges(input: CategoryManagementInput, revision: string) {
  return await callAction('estimateCategoryPolicyChanges', {
    announcementCommentsEnabled: input.announcementCommentsEnabled,
    deletedIssueCategoryIds: input.deletedIssueCategoryIds,
    issueCategories: input.issueCategories,
    revision,
  });
}

export async function listPlatformJobs() {
  return await callAction('listPlatformJobs', {});
}

export async function savePlatformSettings(settings: PlatformSettings, revision: string) {
  return await callAction('savePlatformSettings', { ...settings, revision });
}

export async function estimateRetentionCleanup(settings: PlatformSettings, revision: string) {
  return await callAction('estimateRetentionCleanup', { ...settings, revision });
}
