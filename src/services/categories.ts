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

export async function saveCategoryManagement(input: CategoryManagementInput, revision: string) {
  const action = invokeBackendAction<
    CategoryManagementInput & { revision: string },
    CategoryManagementCatalog & { success: boolean }
  >('saveCategoryManagement');
  const result = await action({ ...input, revision });
  markSessionBootstrapStale();
  return result;
}

export async function estimateCategoryPolicyChanges(input: CategoryManagementInput, revision: string) {
  return await invokeBackendAction<
    Pick<CategoryManagementInput, 'announcementCommentsEnabled' | 'deletedIssueCategoryIds' | 'issueCategories'> & { revision: string },
    { estimates: PolicyImpactEstimate[]; totalEstimatedRows: number }
  >('estimateCategoryPolicyChanges')({
    announcementCommentsEnabled: input.announcementCommentsEnabled,
    deletedIssueCategoryIds: input.deletedIssueCategoryIds,
    issueCategories: input.issueCategories,
    revision,
  });
}

export async function listPlatformJobs() {
  return await invokeBackendAction<Record<string, never>, { entries: PlatformJob[] }>(
    'listPlatformJobs',
  )({});
}

export async function savePlatformSettings(settings: PlatformSettings, revision: string) {
  const action = invokeBackendAction<
    PlatformSettings & { revision: string },
    PlatformSettings & { estimatedRows: number; jobId: string | null; revision: string; success: boolean }
  >('savePlatformSettings');
  return await action({ ...settings, revision });
}

export async function estimateRetentionCleanup(settings: PlatformSettings, revision: string) {
  return await invokeBackendAction<
    PlatformSettings & { revision: string },
    { details: Record<string, number>; updatedDetails: Record<string, number>; totalDeletedRows: number; totalUpdatedRows: number; totalEstimatedRows: number }
  >('estimateRetentionCleanup')({ ...settings, revision });
}
