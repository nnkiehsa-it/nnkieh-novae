import {
  getDefaultIssueRouteFilter,
  isKnownIssueCategory,
} from '@/constants/categories';
import type { IssueReadAccess } from '@/types/categories';
import type {
  IssueCursor,
  IssueRecord,
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

function normalizeCategory(value: unknown): IssueRecord['category'] {
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

export function normalizeIssueRecord(id: string, data: Record<string, unknown>): IssueRecord {
  const category = normalizeCategory(data.category);
  const isOwnIssue = data.isOwnIssue === true;
  const supportEnabled = data.support_enabled === true;

  const record: IssueRecord = {
    id,
    title: String(data.title ?? ''),
    content: String(data.content ?? ''),
    created_at: normalizeDate(data.created_at),
    closed_at: normalizeDate(data.closed_at),
    support_count: typeof data.support_count === 'number' ? data.support_count : 0,
    status: normalizeStatus(data.status),
    category,
    read_access: normalizeReadAccess(data.read_access),
    comments_enabled: data.comments_enabled !== false,
    support_enabled: supportEnabled,
    support_goal: typeof data.support_goal === 'number' ? data.support_goal : null,
    support_deadline_at: normalizeDate(
      data.support_deadline_at
    ),
    response_deadline_at: normalizeDate(
      data.response_deadline_at
    ),
    review_approved_at: normalizeDate(data.review_approved_at),
    result_content: typeof data.result_content === 'string'
      ? data.result_content
      : undefined,
    support_met_at: normalizeDate(
      data.support_met_at
    ),
    review_rejection_reason: typeof data.review_rejection_reason === 'string'
      ? data.review_rejection_reason
      : undefined,
    currentUserSupported: data.currentUserSupported === true || (isOwnIssue && supportEnabled),
    isOwnIssue,
    canManageIssue: data.canManageIssue === true,
    canViewAuthor: data.canViewAuthor === true,
    deleting: data.deleting === true,
    author_uid: data.canViewAuthor === true && typeof data.author_uid === 'string'
      ? data.author_uid
      : null,
    author_name: data.canViewAuthor === true && typeof data.author_name === 'string'
      ? data.author_name
      : null,
    author_photo_url: data.canViewAuthor === true && typeof data.author_photo_url === 'string'
      ? data.author_photo_url
      : null,
  };

  return record;
}

export function normalizeIssueCursor(data: unknown): IssueCursor | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id : '';
  const createdAt = normalizeDate(record.created_at);
  if (!id || !createdAt) return null;

  return {
    id,
    created_at: createdAt,
    sort_date: normalizeDate(record.sort_date),
    sort_number: typeof record.sort_number === 'number' ? record.sort_number : null,
  };
}

export function withSupportState(issues: IssueRecord[], supportedIssueIds?: Set<string>) {
  if (!supportedIssueIds) {
    return issues;
  }
  return issues.map((issue) => ({
    ...issue,
    currentUserSupported: issue.currentUserSupported || supportedIssueIds.has(issue.id),
  }));
}
