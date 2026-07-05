import type { IssueStatus, IssueStatusBucket } from '@/types';

export const TABLE_PAGE_SIZE = 10;
export const STATUS_BUCKETS: Record<IssueStatusBucket, IssueStatus[]> = {
  active: ['under-review', 'pending', 'processing'],
  closed: ['auto-rejected', 'review-rejected', 'infeasible', 'completed'],
};

export const PUBLIC_STATUS_BUCKETS: Record<IssueStatusBucket, IssueStatus[]> = {
  active: ['pending', 'processing'],
  closed: ['auto-rejected', 'infeasible', 'completed'],
};
