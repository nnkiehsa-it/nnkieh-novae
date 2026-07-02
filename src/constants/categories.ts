import {
  DEFAULT_ISSUE_CATEGORY,
  ISSUE_CATEGORIES,
  ISSUE_CATEGORY_LABELS,
  getIssueResponseDeadlineDays,
  getIssueResponseDeadlineStart,
  getIssueSupportGoal,
  getIssueCategoryLabel,
  isIssueCategory,
  issueAllowsCommentsForStatus,
  issueAllowsSupport,
  issueAutoRejectsUnmetSupport,
  issueIsPrivateToOwner,
  issueRequiresReview,
  issueStoresAuthorPrivately,
} from '@/generated/issue-categories';
import type { IssueCategory, IssueFilter, IssueRouteFilter, WritableIssueCategory } from '@/types';

interface CategoryOption<TValue extends string> {
  value: TValue;
  label: string;
}

const ISSUE_CATEGORY_OPTIONS: CategoryOption<WritableIssueCategory>[] = ISSUE_CATEGORIES.map((category) => ({
  value: category.id,
  label: category.label,
}));

export const ISSUE_FILTER_OPTIONS: CategoryOption<IssueFilter>[] = [...ISSUE_CATEGORY_OPTIONS];

const ISSUE_ROUTE_FILTER_OPTIONS: CategoryOption<IssueRouteFilter>[] = [
  ...ISSUE_FILTER_OPTIONS,
  { value: 'my-proposals', label: '我的提案' },
];

const ISSUE_ROUTE_FILTER_VALUES = ISSUE_ROUTE_FILTER_OPTIONS.map((option) => option.value);

export const DEFAULT_ISSUE_ROUTE_FILTER: IssueRouteFilter = DEFAULT_ISSUE_CATEGORY;

export function isIssueRouteFilter(value: unknown): value is IssueRouteFilter {
  return typeof value === 'string' && ISSUE_ROUTE_FILTER_VALUES.includes(value as IssueRouteFilter);
}

export function normalizeIssueRouteFilterParam(param: unknown): IssueRouteFilter {
  const value = Array.isArray(param) ? param[0] : param;
  return isIssueRouteFilter(value) ? value : DEFAULT_ISSUE_ROUTE_FILTER;
}

export {
  DEFAULT_ISSUE_CATEGORY,
  ISSUE_CATEGORY_LABELS,
  getIssueResponseDeadlineDays,
  getIssueResponseDeadlineStart,
  getIssueSupportGoal,
  getIssueCategoryLabel,
  isIssueCategory,
  issueAllowsCommentsForStatus,
  issueAllowsSupport,
  issueAutoRejectsUnmetSupport,
  issueIsPrivateToOwner,
  issueRequiresReview,
  issueStoresAuthorPrivately,
};
