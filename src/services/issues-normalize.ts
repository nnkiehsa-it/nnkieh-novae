import {
  getDefaultIssueRouteFilter,
  isKnownIssueCategory,
} from '@/constants/categories';
import type { IssueReadAccess } from '@/types/categories';
import type {
  IssueCursor,
  IssueRecord,
  IssueSummary,
  IssueStatus,
} from '@/types';

export function normalizeDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'number') {
    return new Date(value);
  }

  if (typeof value === 'string') {
    const time = Date.parse(value);
    return Number.isFinite(time) ? new Date(time) : null;
  }

  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    const date = value.toDate();
    return date instanceof Date ? date : null;
  }

  return null;
}

function normalizeCategory(value: unknown): IssueSummary['category'] {
  const fallback = getDefaultIssueRouteFilter();
  return isKnownIssueCategory(value) ? value : fallback === 'my-proposals' ? '' : fallback;
}

function normalizeReadAccess(value: unknown): IssueReadAccess {
  return value === 'school' || value === 'reviewed-school' || value === 'owner-admin'
    ? value
    : 'owner-admin';
}

export function normalizeStatus(value: unknown): IssueStatus {
  if (
    value === 'under-review' ||
    value === 'pending' ||
    value === 'processing' ||
    value === 'auto-rejected' ||
    value === 'review-rejected' ||
    value === 'infeasible' ||
    value === 'completed'
  ) {
    return value;
  }
  return 'pending';
}

export function normalizeIssueSummary(id: string, data: Record<string, unknown>): IssueSummary {
  const category = normalizeCategory(data.category);
  const isOwnIssue = data.isOwnIssue === true;
  const supportEnabled = data.supportEnabled === true;

  const record: IssueSummary = {
    id,
    title: String(data.title ?? ''),
    created_at: normalizeDate(data.createdAt),
    closed_at: normalizeDate(data.closedAt),
    support_count: typeof data.supportCount === 'number' ? data.supportCount : 0,
    status: normalizeStatus(data.status),
    category,
    read_access: normalizeReadAccess(data.readAccess),
    comments_enabled: data.commentsEnabled !== false,
    support_enabled: supportEnabled,
    support_goal: typeof data.supportGoal === 'number' ? data.supportGoal : null,
    support_deadline_at: normalizeDate(
      data.supportDeadlineAt
    ),
    response_deadline_at: normalizeDate(
      data.responseDeadlineAt
    ),
    review_approved_at: normalizeDate(data.reviewApprovedAt),
    result_content: typeof data.resultContent === 'string'
      ? data.resultContent
      : undefined,
    support_met_at: normalizeDate(
      data.supportMetAt
    ),
    review_rejection_reason: typeof data.reviewRejectionReason === 'string'
      ? data.reviewRejectionReason
      : undefined,
    currentUserSupported: data.currentUserSupported === true || (isOwnIssue && supportEnabled),
    isOwnIssue,
    canManageIssue: data.canManageIssue === true,
    canViewAuthor: data.canViewAuthor === true,
    deleting: data.deleting === true,
    author_uid: data.canViewAuthor === true && typeof data.authorUid === 'string'
      ? data.authorUid
      : null,
  };

  return record;
}

export function normalizeIssueRecord(id: string, data: Record<string, unknown>): IssueRecord {
  return {
    ...normalizeIssueSummary(id, data),
    content: String(data.content ?? ''),
  };
}

export function normalizeIssueCursor(data: unknown): IssueCursor | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id : '';
  const createdAt = normalizeDate(record.createdAt);
  if (!id || !createdAt) return null;

  return {
    id,
    created_at: createdAt,
    sort_date: normalizeDate(record.sortDate),
    sort_number: typeof record.sortNumber === 'number' ? record.sortNumber : null,
  };
}

export function withSupportState<T extends IssueSummary>(issues: T[], supportedIssueIds?: Set<string>) {
  if (!supportedIssueIds) {
    return issues;
  }
  return issues.map((issue) => ({
    ...issue,
    currentUserSupported: issue.currentUserSupported || supportedIssueIds.has(issue.id),
  }));
}
