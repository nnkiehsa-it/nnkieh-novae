import { invokeBackendAction } from '@/services/backend-action';
import { createRequestId } from '@/lib/request-id';
import type {
  CategoryCatalog,
  FacilityCategoryConfig,
  FacilityCategoryDraft,
  IssueCategoryConfig,
  IssueCategoryDraft,
} from '@/types/categories';

export async function getCategoryCatalog() {
  return await invokeBackendAction<Record<string, never>, CategoryCatalog>('getCategoryCatalog')({});
}

export async function getCategoryManagement() {
  return await invokeBackendAction<Record<string, never>, CategoryCatalog>('getCategoryManagement')({});
}

export async function completeInitialSetup(input: {
  issueCategories: IssueCategoryDraft[];
  facilityCategories: FacilityCategoryDraft[];
}) {
  const action = invokeBackendAction<typeof input & { requestId: string }, { success: boolean; setupCompleted: boolean }>('completeInitialSetup');
  return await action({ ...input, requestId: createRequestId() });
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
