import type { IssueStatus, IssueStatusBucket } from '@/types';

export const TABLE_PAGE_SIZE = 10;
export const ISSUES_COLLECTION = 'issues';
export const PRIVATE_ISSUE_AUTHORS_COLLECTION = 'private_issue_authors';
export const FIRESTORE_IN_QUERY_LIMIT = 10;

export const STATUS_BUCKETS: Record<IssueStatusBucket, IssueStatus[]> = {
  active: ['under-review', 'pending', 'processing'],
  closed: ['auto-rejected', 'review-rejected', 'infeasible', 'completed'],
};

export const PUBLIC_STATUS_BUCKETS: Record<IssueStatusBucket, IssueStatus[]> = {
  active: ['pending', 'processing'],
  closed: ['auto-rejected', 'infeasible', 'completed'],
};

export function getIssueStatusBucketValues(statusBucket: IssueStatusBucket, isAdmin = false) {
  return isAdmin ? STATUS_BUCKETS[statusBucket] : PUBLIC_STATUS_BUCKETS[statusBucket];
}
