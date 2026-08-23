"use client";

import * as React from "react";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { useCategories } from "@/hooks/use-categories";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import {
  estimateCategoryPolicyChanges,
  getCategoryManagement,
  saveCategoryManagement,
  type CategoryManagementInput,
} from "@/services/categories";
import type {
  FacilityCategoryConfig,
  IssueCategoryConfig,
  PolicyImpactEstimate,
} from "@/types/categories";
import {
  hasValidCategoryIdentity,
  newFacilityCategory,
  newIssueCategory,
  removeCategory,
} from "@/lib/category-management-state";
import { notifyPlatformJobsChanged } from "@/lib/platform-job-events";

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
  const [pendingSave, setPendingSave] = React.useState<CategoryManagementInput | null>(null);
  const [impactEstimates, setImpactEstimates] = React.useState<PolicyImpactEstimate[]>([]);
  const [totalEstimatedRows, setTotalEstimatedRows] = React.useState(0);

  const valid = React.useMemo(() => {
    const issuesValid =
      !issuesEnabled ||
      (hasValidCategoryIdentity(issues) &&
        issues.some((item) => item.isDefault) &&
        issues.every(
          (item) =>
            !item.supportEnabled ||
            (Number(item.supportGoal) > 0 && Number(item.supportDeadlineDays) > 0),
        ));
    const facilitiesValid =
      !facilitiesEnabled ||
      (hasValidCategoryIdentity(facilities) &&
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

  const createInput = React.useCallback((): CategoryManagementInput => ({
    announcementCommentsEnabled: announcementComments,
    deletedFacilityCategoryIds: deletedFacilities,
    deletedIssueCategoryIds: deletedIssues,
    facilitiesEnabled,
    facilityCategories: facilities.map((item, sortOrder) => ({ ...item, sortOrder })),
    issueCategories: issues.map((item, sortOrder) => ({ ...item, sortOrder })),
    issuesEnabled,
  }), [
    announcementComments,
    deletedFacilities,
    deletedIssues,
    facilities,
    facilitiesEnabled,
    issues,
    issuesEnabled,
  ]);

  async function persist(input: CategoryManagementInput) {
    try {
      const result = await feedback.run(() => saveCategoryManagement(input));
      setIssues(result.issueCategories);
      setFacilities(result.facilityCategories);
      setPersistedIssues(new Set(result.issueCategories.map((item) => item.id)));
      setPersistedFacilities(
        new Set(result.facilityCategories.map((item) => item.id)),
      );
      setDeletedIssues([]);
      setDeletedFacilities([]);
      await categories.refresh();
      notifyPlatformJobsChanged();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : t("common.saveFailed"));
    }
  }

  async function save() {
    if (!valid || feedback.busy) return;
    const input = createInput();
    try {
      const impact = await estimateCategoryPolicyChanges(input);
      if (impact.totalEstimatedRows > 0) {
        setPendingSave(input);
        setImpactEstimates(impact.estimates);
        setTotalEstimatedRows(impact.totalEstimatedRows);
        return;
      }
      await persist(input);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : t("common.saveFailed"));
    }
  }

  async function confirmSave() {
    const input = pendingSave;
    setPendingSave(null);
    if (input) await persist(input);
  }

  return {
    addFacility: () => setFacilities((current) => [...current, newFacilityCategory(current.length)]),
    addIssue: () => setIssues((current) => [...current, newIssueCategory(current.length)]),
    announcementComments,
    deleteFacility,
    deleteIssue,
    error,
    facilities,
    facilitiesEnabled,
    issues,
    issuesEnabled,
    impactEstimates,
    impactOpen: pendingSave !== null,
    kind,
    load,
    loading,
    persistedFacilities,
    persistedIssues,
    save,
    confirmSave,
    cancelSave: () => setPendingSave(null),
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
    totalEstimatedRows,
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
