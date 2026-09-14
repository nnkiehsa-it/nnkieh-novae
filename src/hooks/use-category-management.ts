"use client";

import * as React from "react";

import { useI18n } from "@/i18n";
import { useCategories } from "@/hooks/use-categories";
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
} from "@/lib/category-management-state";
import { notifyPlatformJobsChanged } from "@/lib/platform-job-events";
import type { FacilityCategoryConfig, IssueCategoryConfig } from "@/types/categories";

export type { CategoryManagementInput } from "@/services/categories";

interface CategoryReading {
  /** The identifiers the backend already holds, which may no longer be renamed. */
  persisted: string[];
  stored: CategoryManagementInput;
}

function withSortOrder<T>(items: T[]) {
  return items.map((item, sortOrder) => ({ ...item, sortOrder }));
}

export function useCategoryManagement() {
  const categories = useCategories();
  const { t } = useI18n();
  const { remember, value: reading } = useRememberedState<CategoryReading | null>(
    "admin-categories",
    null,
  );
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const stored = reading?.stored ?? null;
  const persisted = React.useMemo(() => new Set(reading?.persisted ?? []), [reading]);

  const adopt = React.useCallback(
    (result: {
      facilityCategories: FacilityCategoryConfig[];
      features: {
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

  const load = React.useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      adopt(await getCategoryManagement());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("common.loadFailed"));
    } finally {
      setBusy(false);
    }
  }, [adopt, t]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const draft = useDraft<CategoryManagementInput>({
    estimate: async (value) => {
      const impact = await estimateCategoryPolicyChanges(value);
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
    save: async (value) => {
      const result = await saveCategoryManagement({
        ...value,
        facilityCategories: withSortOrder(value.facilityCategories),
        issueCategories: withSortOrder(value.issueCategories),
      });
      const next: CategoryManagementInput = {
        ...value,
        deletedFacilityCategoryIds: [],
        deletedIssueCategoryIds: [],
        facilityCategories: result.facilityCategories,
        issueCategories: result.issueCategories,
      };
      remember({
        persisted: [
          ...result.issueCategories.map((item) => item.id),
          ...result.facilityCategories.map((item) => item.id),
        ],
        stored: next,
      });
      await categories.refresh();
      notifyPlatformJobsChanged();
      return next;
    },
    source: stored,
    validate: (value) =>
      (!value.issuesEnabled
        || (hasValidCategoryIdentity(value.issueCategories)
          && value.issueCategories.some((item) => item.isDefault)
          && value.issueCategories.every(
            (item) =>
              !item.supportEnabled
              || (Number(item.supportGoal) > 0 && Number(item.supportDeadlineDays) > 0),
          )))
      && (!value.facilitiesEnabled
        || (hasValidCategoryIdentity(value.facilityCategories)
          && value.facilityCategories.some((item) => item.isDefault))),
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
