import { DATA_RETENTION } from "@/generated/data-retention";
import { DEFAULT_OPERATION_POLICIES, OPERATION_POLICIES, type OperationPolicies, type OperationPolicyKey } from "@/generated/operations";
import { RATE_LIMITS } from "@/generated/rate-limits";
import type { DataRetentionSettings, FacilityCategoryConfig, ImageUploadSettings, IssueCategoryConfig, PlatformSettings } from "@/types/categories";

export interface SettingPreset<T> {
  id: string;
  labelKey: string;
  detailKey: string;
  values: T;
}

export const DEFAULT_IMAGE_SETTINGS: ImageUploadSettings = {
  maxDimension: RATE_LIMITS.imageCompression.maxDimension,
  maxUploadKilobytes: RATE_LIMITS.imageCompression.maxUploadKilobytes,
  webpQuality: RATE_LIMITS.imageCompression.webpQuality,
};

export const IMAGE_PRESETS: SettingPreset<ImageUploadSettings>[] = [
  { id: "standard", labelKey: "admin.presetStandard", detailKey: "admin.imageStandardDetail", values: DEFAULT_IMAGE_SETTINGS },
  { id: "compact", labelKey: "admin.presetCompact", detailKey: "admin.imageCompactDetail", values: { maxDimension: 1600, maxUploadKilobytes: 500, webpQuality: 0.75 } },
  { id: "detailed", labelKey: "admin.presetDetailed", detailKey: "admin.imageDetailedDetail", values: { maxDimension: 3000, maxUploadKilobytes: 1600, webpQuality: 0.9 } },
];

export const RETENTION_PRESETS: SettingPreset<DataRetentionSettings>[] = [
  { id: "standard", labelKey: "admin.presetStandard", detailKey: "admin.retentionStandardDetail", values: { ...DATA_RETENTION } },
  { id: "compact", labelKey: "admin.presetCompact", detailKey: "admin.retentionCompactDetail", values: {
    ...DATA_RETENTION, closedIssuesDays: 180, closedFacilitiesDays: 180, announcementsDays: 365,
    notificationsDays: 14, inactiveAvatarsDays: 90, inactiveProfilePiiDays: 180,
    domainEventDays: 14, backgroundJobFailedDays: 14,
  } },
  { id: "extended", labelKey: "admin.presetExtended", detailKey: "admin.retentionExtendedDetail", values: {
    ...DATA_RETENTION, closedIssuesDays: 1095, closedFacilitiesDays: 1095, announcementsDays: 1095,
    roleAssignmentAuditDays: 1095, adminAuditDays: 1095,
    categoryConfigurationAuditDays: 1095, accessAssignmentAuditDays: 1095,
  } },
];

export const POLICY_GROUPS = ["content", "rates", "client", "jobs", "logs", "realtime"] as const;
export type PolicyGroup = typeof POLICY_GROUPS[number];

const POLICY_OVERRIDES: Partial<Record<PolicyGroup, Array<SettingPreset<Partial<OperationPolicies>>>>> = {
  content: [{ id: "extended", labelKey: "admin.presetExtended", detailKey: "admin.contentExtendedDetail", values: {
    titleLength: 80, contentLength: 4000, commentLength: 500, resultLength: 4000,
  } }],
  rates: [{ id: "restricted", labelKey: "admin.presetRestricted", detailKey: "admin.ratesRestrictedDetail", values: {
    readBurst: 30, writeBurst: 10, sensitiveBurst: 5, uploadBurst: 3, resolveBurst: 15,
    issueCreateDaily: 5, facilityCreateDaily: 5, commentCreateHourly: 30, imageUploadDaily: 25,
  } }],
  client: [{ id: "compact", labelKey: "admin.presetCompact", detailKey: "admin.clientCompactDetail", values: {
    viewMemoryEntries: 50, feedPages: 3, mediaBrowserSeconds: 180, mediaEdgeSeconds: 180, avatarRevalidateHours: 48,
  } }],
  jobs: [
    { id: "gentle", labelKey: "admin.presetGentle", detailKey: "admin.jobsGentleDetail", values: {
      notionBatchSize: 5, notificationBatchSize: 10, realtimeBatchSize: 25, jobBatchSize: 5, policyBatchSize: 50,
    } },
    { id: "catchup", labelKey: "admin.presetCatchup", detailKey: "admin.jobsCatchupDetail", values: {
      notionBatchSize: 25, notificationBatchSize: 50, realtimeBatchSize: 100, jobBatchSize: 25, policyBatchSize: 250,
    } },
  ],
  logs: [{ id: "extended", labelKey: "admin.presetExtended", detailKey: "admin.logsExtendedDetail", values: {
    notionArchiveDays: 1095, errorRetentionDays: 90, metricsRetentionDays: 90,
  } }],
};

export function policyGroupValues(values: OperationPolicies, group: PolicyGroup): Partial<OperationPolicies> {
  return Object.fromEntries(Object.entries(values).filter(([key]) => OPERATION_POLICIES[key as OperationPolicyKey].group === group));
}

export function policyPresets(group: PolicyGroup): SettingPreset<Partial<OperationPolicies>>[] {
  const defaults = policyGroupValues(DEFAULT_OPERATION_POLICIES, group);
  return [
    { id: "standard", labelKey: "admin.presetStandard", detailKey: "admin.policyStandardDetail", values: defaults },
    ...(POLICY_OVERRIDES[group] ?? []).map((preset) => ({ ...preset, values: { ...defaults, ...preset.values } })),
  ];
}

export function validOperationSettings(values: OperationPolicies) {
  return Object.entries(OPERATION_POLICIES).every(([key, spec]) => {
    const value = values[key as OperationPolicyKey];
    return Number.isInteger(value) && value >= spec.min && value <= spec.max;
  });
}

export function validPlatformSettings({ imageUploads, retention }: PlatformSettings) {
  return Number.isInteger(imageUploads.maxDimension) && imageUploads.maxDimension >= 256 && imageUploads.maxDimension <= 8000
    && Number.isInteger(imageUploads.maxUploadKilobytes) && imageUploads.maxUploadKilobytes >= 100
    && imageUploads.maxUploadKilobytes <= RATE_LIMITS.imageCompression.maxPlatformUploadKilobytes
    && Number.isFinite(imageUploads.webpQuality) && imageUploads.webpQuality >= 0.4 && imageUploads.webpQuality <= 0.95
    && Object.entries(DATA_RETENTION).every(([key, defaultValue]) => {
      const value = retention[key as keyof DataRetentionSettings];
      return typeof defaultValue === "boolean" ? typeof value === "boolean"
        : Number.isInteger(value) && Number(value) >= 1 && Number(value) <= (key.endsWith("Hours") ? 87_600 : 3650);
    });
}

type IssueRules = Pick<IssueCategoryConfig, "readAccess" | "authorVisible" | "commentsEnabled" | "supportEnabled" | "supportGoal" | "supportDeadlineDays" | "maxImages" | "commentMaxImages" | "authorDeleteEnabled">;
export const ISSUE_PRESETS: SettingPreset<IssueRules>[] = [
  { id: "public", labelKey: "admin.categoryPublic", detailKey: "admin.categoryPublicDetail", values: {
    readAccess: "school", authorVisible: true, commentsEnabled: true, supportEnabled: true,
    supportGoal: 30, supportDeadlineDays: 14, maxImages: RATE_LIMITS.imageUploads.issueMaxImages,
    commentMaxImages: RATE_LIMITS.imageUploads.commentMaxImages, authorDeleteEnabled: false,
  } },
  { id: "reviewed", labelKey: "admin.categoryReviewed", detailKey: "admin.categoryReviewedDetail", values: {
    readAccess: "reviewed-school", authorVisible: true, commentsEnabled: true, supportEnabled: false,
    supportGoal: null, supportDeadlineDays: null, maxImages: RATE_LIMITS.imageUploads.issueMaxImages,
    commentMaxImages: RATE_LIMITS.imageUploads.commentMaxImages, authorDeleteEnabled: false,
  } },
  { id: "private", labelKey: "admin.categoryPrivate", detailKey: "admin.categoryPrivateDetail", values: {
    readAccess: "owner-admin", authorVisible: true, commentsEnabled: false, supportEnabled: false,
    supportGoal: null, supportDeadlineDays: null, maxImages: RATE_LIMITS.imageUploads.issueMaxImages,
    commentMaxImages: RATE_LIMITS.imageUploads.commentMaxImages, authorDeleteEnabled: false,
  } },
];

export const FACILITY_PRESETS: SettingPreset<Pick<FacilityCategoryConfig, "maxImages" | "authorDeleteEnabled">>[] = [
  { id: "standard", labelKey: "admin.presetStandard", detailKey: "admin.facilityStandardDetail", values: {
    maxImages: RATE_LIMITS.imageUploads.facilityMaxImages, authorDeleteEnabled: false,
  } },
  { id: "self-service", labelKey: "admin.categorySelfService", detailKey: "admin.facilitySelfServiceDetail", values: {
    maxImages: RATE_LIMITS.imageUploads.facilityMaxImages, authorDeleteEnabled: true,
  } },
];
