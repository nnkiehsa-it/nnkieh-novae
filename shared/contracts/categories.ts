import * as v from "valibot";
import { DATA_RETENTION } from "../data-retention.ts";
import { IMAGE_COMPRESSION } from "../rate-limits.ts";
import { action, Count, NoInput, NullableTimestamp, Success, Timestamp, Uuid } from "../contract.ts";

export const IssueReadAccess = v.picklist(["school", "reviewed-school", "owner-admin"], "validation-required");
export type IssueReadAccess = v.InferOutput<typeof IssueReadAccess>;

// A malformed category or setting is answered with one code, whichever field it is.
const REQUIRED = "validation-required";
const Flag = v.boolean(REQUIRED);
const ImageLimit = v.pipe(v.number(REQUIRED), v.integer(REQUIRED), v.minValue(0, REQUIRED), v.maxValue(20, REQUIRED));
const PositiveInteger = v.pipe(v.number(REQUIRED), v.integer(REQUIRED), v.minValue(1, REQUIRED), v.maxValue(2_147_483_647, REQUIRED));

/** A category as everything that files content under it reads it. */
export const IssueCategory = v.object({
  id: v.string(),
  label: v.string(),
  readAccess: IssueReadAccess,
  authorVisible: v.boolean(),
  authorDeleteEnabled: v.boolean(),
  commentsEnabled: v.boolean(),
  supportEnabled: v.boolean(),
  supportGoal: v.nullable(Count),
  supportDeadlineDays: v.nullable(Count),
  maxImages: Count,
  commentMaxImages: Count,
  isDefault: v.boolean(),
  sortOrder: v.number(),
});
export type IssueCategory = v.InferOutput<typeof IssueCategory>;

export const FacilityCategory = v.object({
  id: v.string(),
  label: v.string(),
  authorDeleteEnabled: v.boolean(),
  maxImages: Count,
  isDefault: v.boolean(),
  sortOrder: v.number(),
});
export type FacilityCategory = v.InferOutput<typeof FacilityCategory>;

export const PlatformFeatures = v.object({
  announcementMaxImages: Count,
  announcementCommentMaxImages: Count,
  announcementCommentsEnabled: v.boolean(),
  facilitiesEnabled: v.boolean(),
  issuesEnabled: v.boolean(),
});
export type PlatformFeatures = v.InferOutput<typeof PlatformFeatures>;

const FeatureSwitches = {
  announcementCommentsEnabled: Flag,
  facilitiesEnabled: Flag,
  issuesEnabled: Flag,
};

function wholeNumber(min: number, max: number) {
  return v.pipe(v.number(REQUIRED), v.integer(REQUIRED), v.minValue(min, REQUIRED), v.maxValue(max, REQUIRED));
}

export const ImageUploadSettings = v.object({
  maxDimension: wholeNumber(256, 8000),
  maxUploadKilobytes: wholeNumber(100, IMAGE_COMPRESSION.maxPlatformUploadKilobytes),
  webpQuality: v.pipe(v.number(REQUIRED), v.minValue(0.4, REQUIRED), v.maxValue(0.95, REQUIRED)),
}, REQUIRED);
export type ImageUploadSettings = v.InferOutput<typeof ImageUploadSettings>;

type RetentionKey = keyof typeof DATA_RETENTION;
const retentionDays = (key: string) => wholeNumber(1, key.endsWith("Hours") ? 87_600 : 3650);

/** How long each kind of record is kept: a switch or a number of days (or hours) per entry. */
export const DataRetentionSettings = v.object(
  Object.fromEntries(Object.entries(DATA_RETENTION).map(([key, fallback]) => [
    key,
    typeof fallback === "boolean" ? Flag : retentionDays(key),
  ])) as {
    [Key in RetentionKey]: (typeof DATA_RETENTION)[Key] extends boolean ? typeof Flag : ReturnType<typeof retentionDays>
  },
  REQUIRED,
);
export type DataRetentionSettings = v.InferOutput<typeof DataRetentionSettings>;

export const PlatformSettings = v.object({ imageUploads: ImageUploadSettings, retention: DataRetentionSettings }, REQUIRED);
export type PlatformSettings = v.InferOutput<typeof PlatformSettings>;

export const CategoryCatalog = v.object({
  setupCompleted: v.boolean(),
  features: PlatformFeatures,
  imageUploads: ImageUploadSettings,
  issueCategories: v.array(IssueCategory),
  facilityCategories: v.array(FacilityCategory),
});
export type CategoryCatalog = v.InferOutput<typeof CategoryCatalog>;

export const CategoryManagement = v.object({
  ...CategoryCatalog.entries,
  categoryRevision: v.string(),
  platformRevision: v.string(),
  platformSettings: PlatformSettings,
});
export type CategoryManagement = v.InferOutput<typeof CategoryManagement>;

// What an administrator writes.

const CategoryId = v.pipe(v.string(REQUIRED), v.trim(), v.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u, REQUIRED));
const CategoryLabel = v.pipe(v.string(REQUIRED), v.trim(), v.minLength(1, REQUIRED), v.maxLength(40, REQUIRED));
const Revision = v.pipe(v.string(REQUIRED), v.regex(/^[a-f0-9]{32}$/u, REQUIRED));

/**
 * An issue category as written. Support needs a goal and a deadline; a
 * category only its author and administrators read always shows the author.
 */
export const IssueCategoryInput = v.pipe(
  v.object({
    id: CategoryId,
    label: CategoryLabel,
    readAccess: IssueReadAccess,
    authorVisible: Flag,
    authorDeleteEnabled: Flag,
    commentsEnabled: Flag,
    supportEnabled: Flag,
    supportGoal: v.nullable(PositiveInteger),
    supportDeadlineDays: v.nullable(PositiveInteger),
    maxImages: ImageLimit,
    commentMaxImages: ImageLimit,
    isDefault: Flag,
  }, REQUIRED),
  v.check(
    (category) => !category.supportEnabled || (category.supportGoal !== null && category.supportDeadlineDays !== null),
    REQUIRED,
  ),
  v.transform((category) => ({
    ...category,
    authorVisible: category.readAccess === "owner-admin" || category.authorVisible,
    supportGoal: category.supportEnabled ? category.supportGoal : null,
    supportDeadlineDays: category.supportEnabled ? category.supportDeadlineDays : null,
  })),
);
export type IssueCategoryInput = v.InferInput<typeof IssueCategoryInput>;

export const FacilityCategoryInput = v.object({
  id: CategoryId,
  label: CategoryLabel,
  authorDeleteEnabled: Flag,
  maxImages: ImageLimit,
  isDefault: Flag,
}, REQUIRED);
export type FacilityCategoryInput = v.InferInput<typeof FacilityCategoryInput>;

/** Categories in display order: ids unique, and exactly one default unless there are none. */
function categoryList<T extends v.GenericSchema<unknown, { id: string; isDefault: boolean }>>(item: T) {
  return v.pipe(
    v.array(item, REQUIRED),
    v.check((categories) => new Set(categories.map((category) => category.id)).size === categories.length, REQUIRED),
    v.check((categories) => categories.length === 0 || categories.filter((category) => category.isDefault).length === 1, REQUIRED),
  );
}

const DeletedCategoryIds = v.pipe(
  v.array(CategoryId, REQUIRED),
  v.check((ids) => new Set(ids).size === ids.length, REQUIRED),
);

const CategoryManagementInput = v.pipe(
  v.object({
    ...FeatureSwitches,
    revision: Revision,
    announcementMaxImages: ImageLimit,
    announcementCommentMaxImages: ImageLimit,
    issueCategories: categoryList(IssueCategoryInput),
    facilityCategories: categoryList(FacilityCategoryInput),
    deletedIssueCategoryIds: DeletedCategoryIds,
    deletedFacilityCategoryIds: DeletedCategoryIds,
  }),
  v.check((input) => (!input.issuesEnabled || input.issueCategories.length > 0)
    && (!input.facilitiesEnabled || input.facilityCategories.length > 0), REQUIRED),
  v.check((input) => !input.issueCategories.some((category) => input.deletedIssueCategoryIds.includes(category.id))
    && !input.facilityCategories.some((category) => input.deletedFacilityCategoryIds.includes(category.id)), REQUIRED),
);

const RetentionEstimate = v.object({
  details: v.record(v.string(), Count),
  updatedDetails: v.record(v.string(), Count),
  totalDeletedRows: Count,
  totalUpdatedRows: Count,
  totalEstimatedRows: Count,
});
export type RetentionEstimate = v.InferOutput<typeof RetentionEstimate>;

export const PolicyImpactEstimate = v.object({ jobType: v.string(), scopeId: v.string(), estimatedRows: Count });
export type PolicyImpactEstimate = v.InferOutput<typeof PolicyImpactEstimate>;

export const PlatformJob = v.object({
  id: Uuid,
  jobType: v.string(),
  engineType: v.string(),
  scopeId: v.string(),
  status: v.picklist(["pending", "processing", "completed", "failed", "superseded"]),
  estimatedRows: Count,
  processedRows: Count,
  affectedRows: Count,
  failureId: v.nullable(Uuid),
  result: v.record(v.string(), v.unknown()),
  createdAt: Timestamp,
  updatedAt: Timestamp,
  startedAt: NullableTimestamp,
  completedAt: NullableTimestamp,
});
export type PlatformJob = v.InferOutput<typeof PlatformJob>;

export const CATEGORY_ACTIONS = {
  getCategoryCatalog: action({ group: "read", input: NoInput, output: CategoryCatalog }),
  getCategoryManagement: action({ group: "read", input: NoInput, output: CategoryManagement }),
  estimateCategoryPolicyChanges: action({
    group: "read",
    input: v.object({
      revision: Revision,
      announcementCommentsEnabled: Flag,
      issueCategories: categoryList(IssueCategoryInput),
      deletedIssueCategoryIds: DeletedCategoryIds,
    }),
    output: v.object({ estimates: v.array(PolicyImpactEstimate), totalEstimatedRows: Count }),
  }),
  saveCategoryManagement: action({
    group: "admin-write",
    extraLimit: "roleWriteHourly",
    input: CategoryManagementInput,
    output: v.object({ ...CategoryManagement.entries, ...Success.entries }),
  }),
  savePlatformFeatures: action({
    group: "admin-write",
    extraLimit: "roleWriteHourly",
    input: v.object(FeatureSwitches),
    output: v.object({ ...FeatureSwitches, ...Success.entries }),
  }),
  completeInitialSetup: action({
    group: "admin-write",
    extraLimit: "roleWriteHourly",
    input: v.pipe(
      v.object({
        issuesEnabled: Flag,
        facilitiesEnabled: Flag,
        issueCategories: categoryList(IssueCategoryInput),
        facilityCategories: categoryList(FacilityCategoryInput),
      }),
      v.check((input) => (!input.issuesEnabled || input.issueCategories.length > 0)
        && (!input.facilitiesEnabled || input.facilityCategories.length > 0), REQUIRED),
    ),
    output: v.object({ ...Success.entries, alreadyCompleted: Flag }),
  }),
  estimateRetentionCleanup: action({
    group: "read",
    input: v.object({ ...PlatformSettings.entries, revision: Revision }),
    output: RetentionEstimate,
  }),
  savePlatformSettings: action({
    group: "admin-write",
    extraLimit: "roleWriteHourly",
    input: v.object({ ...PlatformSettings.entries, revision: Revision }),
    output: v.object({
      ...RetentionEstimate.entries,
      ...PlatformSettings.entries,
      ...Success.entries,
      estimatedRows: Count,
      jobId: v.nullable(Uuid),
      revision: v.string(),
    }),
  }),
  listPlatformJobs: action({ group: "read", input: NoInput, output: v.object({ entries: v.array(PlatformJob) }) }),
};
