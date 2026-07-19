import { findIssueCategory, getDefaultIssueCategoryId, getIssueCategorySnapshot } from '@/composables/useCategories';
import type { IssueCategory, IssueFilter, IssueRouteFilter, IssueStatus } from '@/types';
import type { IssueReadAccess } from '@/types/categories';

export interface CategoryOption<TValue extends string> {
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
  return categories.filter((category) => category.isActive).map((category) => ({
    value: category.id,
    label: category.label,
  }));
}

export function getDefaultIssueRouteFilter(): IssueRouteFilter {
  return getDefaultIssueCategoryId() || 'my-proposals';
}

export function isIssueCategory(value: unknown): value is IssueCategory {
  return typeof value === 'string' && findIssueCategory(value)?.isActive === true;
}

export function isKnownIssueCategory(value: unknown): value is IssueCategory {
  return typeof value === 'string' && findIssueCategory(value) !== null;
}

export function isIssueRouteFilter(value: unknown): value is IssueRouteFilter {
  const normalized = Array.isArray(value) ? value[0] : value;
  return normalized === 'my-proposals' || isIssueCategory(normalized);
}

export function normalizeIssueRouteFilterParam(param: unknown): IssueRouteFilter {
  const value = Array.isArray(param) ? param[0] : param;
  return isIssueRouteFilter(value) ? value : getDefaultIssueRouteFilter();
}

export function getIssueCategoryLabel(category: string | null | undefined) {
  return findIssueCategory(category)?.label ?? String(category ?? '');
}

export function issueAllowsSupport(category: string | null | undefined) {
  return findIssueCategory(category)?.supportEnabled === true;
}

export function issueRequiresReview(category: string | null | undefined) {
  return findIssueCategory(category)?.readAccess === 'reviewed-school';
}

export function issueStoresAuthorPrivately(category: string | null | undefined) {
  return findIssueCategory(category)?.authorVisible === false;
}

export function issueIsPrivateToOwner(category: string | null | undefined) {
  return findIssueCategory(category)?.readAccess === 'owner-admin';
}

export function getIssueSupportGoal(category: string | null | undefined) {
  return findIssueCategory(category)?.supportGoal ?? null;
}

export function issueAutoRejectsUnmetSupport(category: string | null | undefined) {
  return findIssueCategory(category)?.supportEnabled === true;
}

export function getIssueResponseDeadlineDays(category: string | null | undefined) {
  return findIssueCategory(category)?.responseDeadlineDays ?? null;
}

export function getIssueResponseDeadlineStart(category: string | null | undefined) {
  const config = findIssueCategory(category);
  if (!config?.responseDeadlineDays) return 'none' as const;
  return config.supportEnabled ? 'support-met' as const : 'created' as const;
}

export function issueAllowsCommentsForStatus(
  readAccess: IssueReadAccess,
  status: IssueStatus,
) {
  if (readAccess === 'reviewed-school') return status === 'pending' || status === 'processing';
  return status !== 'under-review' && status !== 'review-rejected';
}
