export type IssueReadAccess = 'school' | 'reviewed-school' | 'owner-admin';

export interface IssueCategoryConfig {
  id: string;
  label: string;
  readAccess: IssueReadAccess;
  authorVisible: boolean;
  supportEnabled: boolean;
  supportGoal: number | null;
  supportDeadlineDays: number | null;
  responseDeadlineDays: number | null;
  commentsEnabled: boolean;
  isDefault: boolean;
  sortOrder: number;
}

export interface FacilityCategoryConfig {
  id: string;
  label: string;
  isDefault: boolean;
  sortOrder: number;
}

export type CategoryConfig = IssueCategoryConfig | FacilityCategoryConfig;

export interface CategoryCatalog {
  features: PlatformFeatures;
  issueCategories: IssueCategoryConfig[];
  facilityCategories: FacilityCategoryConfig[];
  setupCompleted: boolean;
}

export interface PlatformFeatures {
  announcementCommentsEnabled: boolean;
  facilitiesEnabled: boolean;
  issuesEnabled: boolean;
}

export interface IssueCategoryDraft {
  id: string;
  label: string;
  readAccess: IssueReadAccess | '';
  authorVisible: boolean | null;
  supportEnabled: boolean | null;
  supportGoal: number | null;
  supportDeadlineDays: number | null;
  responseDeadlineDays: number | null;
  commentsEnabled: boolean;
  isDefault: boolean;
}

export interface FacilityCategoryDraft {
  id: string;
  isDefault: boolean;
  label: string;
}
