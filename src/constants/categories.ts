import {
  findIssueCategory,
  getDefaultIssueCategoryId,
  getIssueCategorySnapshot,
} from "@/hooks/use-categories";
import type {
  IssueFilter,
  IssueRouteFilter,
  IssueStatus,
} from "@/types";
import type { IssueReadAccess } from "@/types/categories";

interface CategoryOption<TValue extends string> {
  value: TValue;
  label: string;
}

export function getIssueFilterOptions(): CategoryOption<IssueFilter>[] {
  const defaultCategoryId = getDefaultIssueCategoryId();
  const defaultCategory = findIssueCategory(defaultCategoryId);
  const categories = defaultCategory ? [defaultCategory] : [];
  const seen = new Set(categories.map((category) => category.id));
  for (const category of getIssueCategorySnapshot()) {
    if (category && !seen.has(category.id)) categories.push(category);
  }
  return categories.map((category) => ({
    value: category.id,
    label: category.label,
  }));
}

export function getDefaultIssueRouteFilter(): IssueRouteFilter {
  return getDefaultIssueCategoryId() || "my-proposals";
}

export function getIssueCategoryLabel(category: string | null | undefined) {
  return findIssueCategory(category)?.label ?? String(category ?? "");
}

export function getIssueSupportGoal(category: string | null | undefined) {
  return findIssueCategory(category)?.supportGoal ?? null;
}

export function issueAutoRejectsUnmetSupport(
  category: string | null | undefined,
) {
  return findIssueCategory(category)?.supportEnabled === true;
}

export function issueCategoryAllowsComments(
  category: string | null | undefined,
) {
  return findIssueCategory(category)?.commentsEnabled === true;
}

export function issueAllowsCommentsForStatus(
  readAccess: IssueReadAccess,
  status: IssueStatus,
) {
  if (
    status === "completed" ||
    status === "infeasible" ||
    status === "review-rejected" ||
    status === "auto-rejected"
  ) {
    return false;
  }
  if (readAccess === "reviewed-school")
    return status === "pending" || status === "processing";
  return status !== "under-review";
}
