import { invokeBackendAction } from '@/services/backend-action';
import { markSessionBootstrapStale } from '@/services/session-bootstrap';
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
  announcementMaxImages: number;
  announcementCommentMaxImages: number;
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
  failureId: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export async function getCategoryCatalog(
  options: { onCatalog?: (catalog: Partial<CategoryCatalog>) => void } = {},
) {
  return await invokeBackendAction<Record<string, never>, CategoryCatalog>('getCategoryCatalog', {
    onSegment: (key, data) => {
      if (key) options.onCatalog?.({ [key]: data } as Partial<CategoryCatalog>);
    },
  })({});
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
  const action = invokeBackendAction<typeof input, { success: boolean; setupCompleted: boolean }>('completeInitialSetup');
  return await action(input);
}

type PlatformFeatureSwitches = Pick<PlatformFeatures, 'announcementCommentsEnabled' | 'facilitiesEnabled' | 'issuesEnabled'>;

export async function savePlatformFeatures(features: PlatformFeatureSwitches) {
  const action = invokeBackendAction<
    PlatformFeatureSwitches,
    PlatformFeatureSwitches & { success: boolean }
  >('savePlatformFeatures');
  const result = await action(features);
  markSessionBootstrapStale();
  return result;
}

export async function saveCategoryManagement(input: CategoryManagementInput) {
  const action = invokeBackendAction<
    typeof input,
    CategoryCatalog & { success: boolean }
  >('saveCategoryManagement');
  const result = await action(input);
  markSessionBootstrapStale();
  return result;
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
    PlatformSettings,
    PlatformSettings & { estimatedRows: number; jobId: string; success: boolean }
  >('savePlatformSettings');
  return await action(settings);
}

export async function estimateRetentionCleanup(settings: PlatformSettings) {
  return await invokeBackendAction<
    PlatformSettings,
    { details: Record<string, number>; totalEstimatedRows: number }
  >('estimateRetentionCleanup')(settings);
}
