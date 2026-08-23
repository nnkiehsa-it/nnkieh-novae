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
  PolicyImpactEstimate,
  PlatformSettings,
} from '@/types/categories';

export interface CategoryManagementInput {
  announcementCommentsEnabled: boolean;
  deletedFacilityCategoryIds: string[];
  deletedIssueCategoryIds: string[];
  facilitiesEnabled: boolean;
  facilityCategories: FacilityCategoryConfig[];
  issueCategories: IssueCategoryConfig[];
  issuesEnabled: boolean;
}

export interface PlatformJob {
  id: string;
  jobType: string;
  scopeId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'superseded';
  estimatedRows: number;
  processedRows: number;
  affectedRows: number;
  result: Record<string, unknown>;
  errorTraceId: string | null;
  createdAtMs: number;
  updatedAtMs: number;
  completedAtMs: number | null;
}

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

export async function saveCategoryManagement(input: CategoryManagementInput) {
  const action = invokeBackendAction<
    typeof input & { requestId: string },
    CategoryCatalog & { success: boolean }
  >('saveCategoryManagement');
  return await action({ ...input, requestId: createRequestId() });
}

export async function estimateCategoryPolicyChanges(input: CategoryManagementInput) {
  return await invokeBackendAction<
    Pick<CategoryManagementInput, 'announcementCommentsEnabled' | 'deletedIssueCategoryIds' | 'issueCategories'>,
    { estimates: PolicyImpactEstimate[]; totalEstimatedRows: number }
  >('estimateCategoryPolicyChanges')({
    announcementCommentsEnabled: input.announcementCommentsEnabled,
    deletedIssueCategoryIds: input.deletedIssueCategoryIds,
    issueCategories: input.issueCategories,
  });
}

export async function listPlatformJobs() {
  return await invokeBackendAction<Record<string, never>, { entries: PlatformJob[] }>(
    'listPlatformJobs',
  )({});
}

export async function savePlatformSettings(settings: PlatformSettings) {
  const action = invokeBackendAction<
    PlatformSettings & { requestId: string },
    PlatformSettings & { estimatedRows: number; jobId: string; success: boolean }
  >('savePlatformSettings');
  return await action({ ...settings, requestId: createRequestId() });
}

export async function estimateRetentionCleanup(settings: PlatformSettings) {
  return await invokeBackendAction<
    PlatformSettings,
    { details: Record<string, number>; totalEstimatedRows: number }
  >('estimateRetentionCleanup')(settings);
}
