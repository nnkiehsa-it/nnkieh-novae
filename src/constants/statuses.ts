import type { FacilityStatus, IssueStatus, IssueStatusBucket } from '@/types';

interface StatusOption<TValue extends string> {
  value: TValue;
  label: string;
}

export const ADMIN_ISSUE_STATUS_OPTIONS: StatusOption<IssueStatus>[] = [
  { value: 'under-review', label: 'common.pendingReview' },
  { value: 'pending', label: 'comments.noReply' },
  { value: 'review-rejected', label: 'common.notApproved' },
  { value: 'processing', label: 'facility.processing' },
  { value: 'infeasible', label: 'issue.notFeasible' },
  { value: 'completed', label: 'facility.completed' },
];

export const ISSUE_STATUS_LABELS: Record<IssueStatus, string> = {
  'under-review': 'common.pendingReview',
  pending: 'comments.noReply',
  processing: 'facility.processing',
  'auto-rejected': 'common.failed',
  'review-rejected': 'common.notApproved',
  infeasible: 'issue.notFeasible',
  completed: 'facility.completed',
};

export const FACILITY_STATUS_LABELS: Record<FacilityStatus, string> = {
  pending: 'facility.toBeAccepted',
  processing: 'facility.processing',
  completed: 'facility.completed',
  'unable-to-handle': 'facility.cannotBeResolved',
};

export const FACILITY_CLOSED_STATUSES: FacilityStatus[] = ['completed', 'unable-to-handle'];

// The statuses a bucket puts on screen, in the order a reader walks a case through them.
export const ISSUE_BUCKET_STATUSES: Record<IssueStatusBucket, readonly IssueStatus[]> = {
  active: ['under-review', 'pending', 'processing'],
  closed: ['completed', 'infeasible', 'review-rejected', 'auto-rejected'],
};

export const FACILITY_BUCKET_STATUSES: Record<IssueStatusBucket, readonly FacilityStatus[]> = {
  active: ['pending', 'processing'],
  closed: ['completed', 'unable-to-handle'],
};

const ISSUE_STATUSES = [...ISSUE_BUCKET_STATUSES.active, ...ISSUE_BUCKET_STATUSES.closed];
const FACILITY_STATUSES = [...FACILITY_BUCKET_STATUSES.active, ...FACILITY_BUCKET_STATUSES.closed];

function statusCounts<TStatus extends string>(statuses: readonly TStatus[], source: unknown) {
  const record = source as Record<string, unknown>;
  return Object.fromEntries(
    statuses.map((status) => {
      const count = Number(record?.[status] ?? 0);
      return [status, Number.isFinite(count) && count > 0 ? Math.round(count) : 0];
    }),
  ) as Record<TStatus, number>;
}

export type IssueStatusCounts = Record<IssueStatus, number>;
export type FacilityStatusCounts = Record<FacilityStatus, number>;

export function toIssueStatusCounts(source: unknown): IssueStatusCounts {
  return statusCounts(ISSUE_STATUSES, source);
}

export function toFacilityStatusCounts(source: unknown): FacilityStatusCounts {
  return statusCounts(FACILITY_STATUSES, source);
}

export function isFacilityClosed(status: FacilityStatus) {
  return FACILITY_CLOSED_STATUSES.includes(status);
}
