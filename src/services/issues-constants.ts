import type { IssueStatus, IssueStatusBucket } from '@/types';

export const TABLE_PAGE_SIZE = 20;
export const STATUS_BUCKETS: Record<IssueStatusBucket, IssueStatus[]> = {
  active: ['under-review', 'pending', 'processing'],
  closed: ['auto-rejected', 'review-rejected', 'infeasible', 'completed'],
};

