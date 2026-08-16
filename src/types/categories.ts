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
  imageUploads: ImageUploadSettings;
  issueCategories: IssueCategoryConfig[];
  facilityCategories: FacilityCategoryConfig[];
  setupCompleted: boolean;
}

export interface ImageUploadSettings {
  announcementMaxImages: number;
  commentMaxImages: number;
  facilityMaxImages: number;
  issueMaxImages: number;
  maxDimension: number;
  maxSourceMegabytes: number;
  maxUploadKilobytes: number;
  webpQuality: number;
}

export interface ClosedContentRetentionSettings {
  closedFacilitiesDays: number;
  closedFacilitiesEnabled: boolean;
  closedIssuesDays: number;
  closedIssuesEnabled: boolean;
}

export interface PlatformSettings {
  imageUploads: ImageUploadSettings;
  retention: ClosedContentRetentionSettings;
}

export interface CategoryManagementCatalog extends CategoryCatalog {
  platformSettings: PlatformSettings;
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
