import { invokeBackendAction } from '@/services/backend-action';
import { createRequestId } from '@/lib/request-id';
import type {
  CategoryCatalog,
  CategoryManagementCatalog,
  FacilityCategoryConfig,
  FacilityCategoryDraft,
  IssueCategoryConfig,
  IssueCategoryDraft,
  PlatformFeatures,
  PlatformSettings,
} from '@/types/categories';

export async function getCategoryCatalog() {
  return await invokeBackendAction<Record<string, never>, CategoryCatalog>('getCategoryCatalog')({});
}

export async function getCategoryManagement() {
  return await invokeBackendAction<Record<string, never>, CategoryManagementCatalog>('getCategoryManagement')({});
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

export async function saveCategoryManagement(input: {
  announcementCommentsEnabled: boolean;
  deletedFacilityCategoryIds: string[];
  deletedIssueCategoryIds: string[];
  facilitiesEnabled: boolean;
  facilityCategories: FacilityCategoryConfig[];
  issueCategories: IssueCategoryConfig[];
  issuesEnabled: boolean;
}) {
  const action = invokeBackendAction<
    typeof input & { requestId: string },
    CategoryCatalog & { success: boolean }
  >('saveCategoryManagement');
  return await action({ ...input, requestId: createRequestId() });
}

export async function savePlatformSettings(settings: PlatformSettings) {
  const action = invokeBackendAction<
    PlatformSettings & { requestId: string },
    PlatformSettings & { success: boolean }
  >('savePlatformSettings');
  return await action({ ...settings, requestId: createRequestId() });
}
