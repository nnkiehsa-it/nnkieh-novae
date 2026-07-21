import { invokeBackendAction } from '@/services/backend-action';
import { createRequestId } from '@/lib/request-id';
import type {
  CategoryCatalog,
  FacilityCategoryConfig,
  FacilityCategoryDraft,
  IssueCategoryConfig,
  IssueCategoryDraft,
  PlatformFeatures,
} from '@/types/categories';

export async function getCategoryCatalog() {
  return await invokeBackendAction<Record<string, never>, CategoryCatalog>('getCategoryCatalog')({});
}

export async function getCategoryManagement() {
  return await invokeBackendAction<Record<string, never>, CategoryCatalog>('getCategoryManagement')({});
}

export async function completeInitialSetup(input: {
  facilitiesEnabled: boolean;
  issueCategories: IssueCategoryDraft[];
  facilityCategories: FacilityCategoryDraft[];
  issuesEnabled: boolean;
}) {
  const action = invokeBackendAction<typeof input & { requestId: string }, { success: boolean; setupCompleted: boolean }>('completeInitialSetup');
  return await action({ ...input, requestId: createRequestId() });
}

export async function savePlatformFeatures(features: PlatformFeatures) {
  const action = invokeBackendAction<
    PlatformFeatures & { requestId: string },
    PlatformFeatures & { success: boolean }
  >('savePlatformFeatures');
  return await action({ ...features, requestId: createRequestId() });
}

export async function saveIssueCategory(category: IssueCategoryConfig | IssueCategoryDraft) {
  const action = invokeBackendAction<
    { category: IssueCategoryConfig | IssueCategoryDraft; requestId: string },
    { category: IssueCategoryConfig }
  >('saveIssueCategory');
  return (await action({ category, requestId: createRequestId() })).category;
}

export async function saveFacilityCategory(category: FacilityCategoryConfig | FacilityCategoryDraft) {
  const action = invokeBackendAction<
    { category: FacilityCategoryConfig | FacilityCategoryDraft; requestId: string },
    { category: FacilityCategoryConfig }
  >('saveFacilityCategory');
  return (await action({ category, requestId: createRequestId() })).category;
}

export async function deleteCategory(input: { kind: 'issue' | 'facility'; id: string }) {
  const action = invokeBackendAction<
    { kind: 'issue' | 'facility'; id: string; requestId: string },
    { success: boolean }
  >('deleteCategory');
  return await action({ ...input, requestId: createRequestId() });
}
