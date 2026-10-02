"use client";

import * as React from "react";

import { useAdminReading } from "@/hooks/use-admin-reading";
import { seedCategoryCatalog } from "@/hooks/use-categories";
import { useDraft } from "@/hooks/use-draft";
import { useRememberedState } from "@/hooks/use-remembered-state";
import {
  estimateCategoryPolicyChanges,
  getCategoryManagement,
  saveCategoryManagement,
  type CategoryManagementInput,
} from "@/services/categories";
import {
  hasValidCategoryIdentity,
  newFacilityCategory,
  newIssueCategory,
  removeCategory,
  validSupportCount,
} from "@/lib/category-management-state";
import { notifyPlatformJobsChanged } from "@/lib/platform-job-events";
import type { FacilityCategoryConfig, IssueCategoryConfig } from "@/types/categories";

export type { CategoryManagementInput } from "@/services/categories";

interface CategoryReading {
  /** The identifiers the backend already holds, which may no longer be renamed. */
  persisted: string[];
  stored: CategoryManagementInput & { revision: string };
}

function withSortOrder<T>(items: T[]) {
  return items.map((item, sortOrder) => ({ ...item, sortOrder }));
}

export function useCategoryManagement() {
  const { remember, value: reading } = useRememberedState<CategoryReading | null>(
    "admin-categories",
    null,
  );
  const { error, invalidate, isActive, loading: busy, read } = useAdminReading("admin-categories", "common.loadFailed");
  const stored = reading?.stored ?? null;
  const persisted = React.useMemo(() => new Set(reading?.persisted ?? []), [reading]);

  const adopt = React.useCallback(
    (result: {
      categoryRevision: string;
      facilityCategories: FacilityCategoryConfig[];
      features: {
        announcementMaxImages: number;
        announcementCommentMaxImages: number;
        announcementCommentsEnabled: boolean;
        facilitiesEnabled: boolean;
        issuesEnabled: boolean;
      };
      issueCategories: IssueCategoryConfig[];
    }) => {
      remember({
        persisted: [
          ...result.issueCategories.map((item) => item.id),
          ...result.facilityCategories.map((item) => item.id),
        ],
        stored: {
          revision: result.categoryRevision,
          announcementMaxImages: result.features.announcementMaxImages,
          announcementCommentMaxImages: result.features.announcementCommentMaxImages,
          announcementCommentsEnabled: result.features.announcementCommentsEnabled,
          deletedFacilityCategoryIds: [],
          deletedIssueCategoryIds: [],
          facilitiesEnabled: result.features.facilitiesEnabled,
          facilityCategories: result.facilityCategories,
          issueCategories: result.issueCategories,
          issuesEnabled: result.features.issuesEnabled,
        },
      });
    },
    [remember],
  );

  const load = React.useCallback(() => read(getCategoryManagement, adopt), [adopt, read]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const draft = useDraft<CategoryReading["stored"]>({
    estimate: async (value, baseline) => {
      const impact = await estimateCategoryPolicyChanges(value, baseline.revision);
      return {
        details: Object.fromEntries(
          impact.estimates.map((entry) => [
            `${entry.jobType}:${entry.scopeId}`,
            entry.estimatedRows,
          ]),
        ),
        totalEstimatedRows: impact.totalEstimatedRows,
      };
    },
    save: async (value, _reason, baseline) => {
      invalidate();
      const result = await saveCategoryManagement({
        ...value,
        facilityCategories: withSortOrder(value.facilityCategories),
        issueCategories: withSortOrder(value.issueCategories),
      }, baseline.revision);
      const next: CategoryReading["stored"] = {
        ...value,
        ...result.features,
        revision: result.categoryRevision,
        deletedFacilityCategoryIds: [],
        deletedIssueCategoryIds: [],
        facilityCategories: result.facilityCategories,
        issueCategories: result.issueCategories,
      };
      if (!isActive()) return next;
      remember({
        persisted: [
          ...result.issueCategories.map((item) => item.id),
          ...result.facilityCategories.map((item) => item.id),
        ],
        stored: next,
      });
      seedCategoryCatalog(result);
      notifyPlatformJobsChanged();
      return next;
    },
    source: stored,
    validate: (value) =>
      [value.announcementMaxImages, value.announcementCommentMaxImages,
        ...value.issueCategories.flatMap((item) => [item.maxImages, item.commentMaxImages]),
        ...value.facilityCategories.map((item) => item.maxImages)]
        .every((limit) => Number.isInteger(limit) && limit >= 0 && limit <= 20)
      &&
      ((!value.issuesEnabled && value.issueCategories.length === 0)
        || (hasValidCategoryIdentity(value.issueCategories)
          && value.issueCategories.filter((item) => item.isDefault).length === 1
          && value.issueCategories.every(
            (item) =>
              !item.supportEnabled
              || (validSupportCount(item.supportGoal) && validSupportCount(item.supportDeadlineDays)),
          )))
      && ((!value.facilitiesEnabled && value.facilityCategories.length === 0)
        || (hasValidCategoryIdentity(value.facilityCategories)
          && value.facilityCategories.filter((item) => item.isDefault).length === 1)),
  });

  const value = draft.value;

  return {
    addFacility: () =>
      draft.update((current) => ({
        ...current,
        facilityCategories: [
          ...current.facilityCategories,
          newFacilityCategory(current.facilityCategories.length),
        ],
      })),
    addIssue: () =>
      draft.update((current) => ({
        ...current,
        issueCategories: [
          ...current.issueCategories,
          newIssueCategory(current.issueCategories.length),
        ],
      })),
    deleteFacility: (index: number) =>
      draft.update((current) => {
        const target = current.facilityCategories[index];
        return {
          ...current,
          deletedFacilityCategoryIds:
            target && persisted.has(target.id)
              ? [...current.deletedFacilityCategoryIds, target.id]
              : current.deletedFacilityCategoryIds,
          facilityCategories: removeCategory(current.facilityCategories, index),
        };
      }),
    deleteIssue: (index: number) =>
      draft.update((current) => {
        const target = current.issueCategories[index];
        return {
          ...current,
          deletedIssueCategoryIds:
            target && persisted.has(target.id)
              ? [...current.deletedIssueCategoryIds, target.id]
              : current.deletedIssueCategoryIds,
          issueCategories: removeCategory(current.issueCategories, index),
        };
      }),
    draft,
    error,
    load,
    loading: reading === null && busy,
    persisted,
    setDefaultFacility: (index: number) =>
      draft.update((current) => ({
        ...current,
        facilityCategories: current.facilityCategories.map((entry, at) => ({
          ...entry,
          isDefault: at === index,
        })),
      })),
    setDefaultIssue: (index: number) =>
      draft.update((current) => ({
        ...current,
        issueCategories: current.issueCategories.map((entry, at) => ({
          ...entry,
          isDefault: at === index,
        })),
      })),
    updateFacility: (index: number, next: FacilityCategoryConfig) =>
      draft.update((current) => ({
        ...current,
        facilityCategories: current.facilityCategories.map((entry, at) =>
          at === index ? next : entry,
        ),
      })),
    updateIssue: (index: number, next: IssueCategoryConfig) =>
      draft.update((current) => ({
        ...current,
        issueCategories: current.issueCategories.map((entry, at) =>
          at === index ? next : entry,
        ),
      })),
    value,
  };
}
