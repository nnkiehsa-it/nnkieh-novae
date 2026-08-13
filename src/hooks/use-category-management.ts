"use client";

import * as React from "react";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { useCategories } from "@/hooks/use-categories";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import {
  getCategoryManagement,
  saveCategoryManagement,
} from "@/services/categories";
import type {
  FacilityCategoryConfig,
  IssueCategoryConfig,
} from "@/types/categories";

const categoryPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

const newIssue = (sortOrder: number): IssueCategoryConfig => ({
  authorVisible: true,
  commentsEnabled: true,
  id: "",
  isDefault: sortOrder === 0,
  label: "",
  readAccess: "school",
  responseDeadlineDays: null,
  sortOrder,
  supportDeadlineDays: null,
  supportEnabled: false,
  supportGoal: null,
});

const newFacility = (sortOrder: number): FacilityCategoryConfig => ({
  id: "",
  isDefault: sortOrder === 0,
  label: "",
  sortOrder,
});

function removeCategory<T extends { isDefault: boolean; sortOrder: number }>(
  values: T[],
  index: number,
) {
  const next = values.filter((_, currentIndex) => currentIndex !== index);
  const hasDefault = next.some((item) => item.isDefault);
  return next.map((item, sortOrder) => ({
    ...item,
    isDefault: hasDefault ? item.isDefault : sortOrder === 0,
    sortOrder,
  }));
}

function hasValidIdentity(values: Array<{ id: string; label: string }>) {
  const ids = values.map((item) => item.id.trim());
  return (
    values.length > 0 &&
    new Set(ids).size === ids.length &&
    values.every(
      (item) => categoryPattern.test(item.id.trim()) && Boolean(item.label.trim()),
    )
  );
}

export function useCategoryManagement() {
  const categories = useCategories();
  const { t } = useI18n();
  const [kind, setKind] = React.useState("issue");
  const [issues, setIssues] = React.useState<IssueCategoryConfig[]>([]);
  const [facilities, setFacilities] = React.useState<FacilityCategoryConfig[]>([]);
  const [persistedIssues, setPersistedIssues] = React.useState<Set<string>>(new Set());
  const [persistedFacilities, setPersistedFacilities] = React.useState<Set<string>>(
    new Set(),
  );
  const [deletedIssues, setDeletedIssues] = React.useState<string[]>([]);
  const [deletedFacilities, setDeletedFacilities] = React.useState<string[]>([]);
  const [issuesEnabled, setIssuesEnabled] = React.useState(true);
  const [facilitiesEnabled, setFacilitiesEnabled] = React.useState(true);
  const [announcementComments, setAnnouncementComments] = React.useState(true);
  const [loading, setLoading] = React.useState(true);
  const feedback = useActionFeedback();
  const [error, setError] = React.useState("");

  const valid = React.useMemo(() => {
    const issuesValid =
      !issuesEnabled ||
      (hasValidIdentity(issues) &&
        issues.some((item) => item.isDefault) &&
        issues.every(
          (item) =>
            !item.supportEnabled ||
            (Number(item.supportGoal) > 0 && Number(item.supportDeadlineDays) > 0),
        ));
    const facilitiesValid =
      !facilitiesEnabled ||
      (hasValidIdentity(facilities) &&
        facilities.some((item) => item.isDefault));
    return issuesValid && facilitiesValid;
  }, [facilities, facilitiesEnabled, issues, issuesEnabled]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getCategoryManagement();
      setIssues(result.issueCategories);
      setFacilities(result.facilityCategories);
      setPersistedIssues(new Set(result.issueCategories.map((item) => item.id)));
      setPersistedFacilities(
        new Set(result.facilityCategories.map((item) => item.id)),
      );
      setIssuesEnabled(result.features.issuesEnabled);
      setFacilitiesEnabled(result.features.facilitiesEnabled);
      setAnnouncementComments(result.features.announcementCommentsEnabled);
      setDeletedIssues([]);
      setDeletedFacilities([]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("common.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  React.useEffect(() => {
    void load();
  }, [load]);

  function deleteIssue(index: number) {
    const item = issues[index];
    if (item?.id && persistedIssues.has(item.id))
      setDeletedIssues((current) => [...current, item.id]);
    setIssues((current) => removeCategory(current, index));
  }

  function deleteFacility(index: number) {
    const item = facilities[index];
    if (item?.id && persistedFacilities.has(item.id))
      setDeletedFacilities((current) => [...current, item.id]);
    setFacilities((current) => removeCategory(current, index));
  }

  async function save() {
    if (!valid || feedback.busy) return;
    try {
      const result = await feedback.run(() =>
        saveCategoryManagement({
          announcementCommentsEnabled: announcementComments,
          deletedFacilityCategoryIds: deletedFacilities,
          deletedIssueCategoryIds: deletedIssues,
          facilitiesEnabled,
          facilityCategories: facilities.map((item, sortOrder) => ({ ...item, sortOrder })),
          issueCategories: issues.map((item, sortOrder) => ({ ...item, sortOrder })),
          issuesEnabled,
        }),
      );
      setIssues(result.issueCategories);
      setFacilities(result.facilityCategories);
      setPersistedIssues(new Set(result.issueCategories.map((item) => item.id)));
      setPersistedFacilities(
        new Set(result.facilityCategories.map((item) => item.id)),
      );
      setDeletedIssues([]);
      setDeletedFacilities([]);
      await categories.refresh();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : t("common.saveFailed"));
    }
  }

  return {
    addFacility: () => setFacilities((current) => [...current, newFacility(current.length)]),
    addIssue: () => setIssues((current) => [...current, newIssue(current.length)]),
    announcementComments,
    deleteFacility,
    deleteIssue,
    error,
    facilities,
    facilitiesEnabled,
    issues,
    issuesEnabled,
    kind,
    load,
    loading,
    persistedFacilities,
    persistedIssues,
    save,
    feedbackState: feedback.state,
    saving: feedback.busy,
    setAnnouncementComments,
    setDefaultFacility: (index: number) =>
      setFacilities((current) =>
        current.map((entry, currentIndex) => ({
          ...entry,
          isDefault: currentIndex === index,
        })),
      ),
    setDefaultIssue: (index: number) =>
      setIssues((current) =>
        current.map((entry, currentIndex) => ({
          ...entry,
          isDefault: currentIndex === index,
        })),
      ),
    setFacilitiesEnabled,
    setIssuesEnabled,
    setKind,
    updateFacility: (index: number, next: FacilityCategoryConfig) =>
      setFacilities((current) =>
        current.map((entry, currentIndex) => (currentIndex === index ? next : entry)),
      ),
    updateIssue: (index: number, next: IssueCategoryConfig) =>
      setIssues((current) =>
        current.map((entry, currentIndex) => (currentIndex === index ? next : entry)),
      ),
    valid,
  };
}
