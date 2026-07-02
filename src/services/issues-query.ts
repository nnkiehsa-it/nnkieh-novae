import type { IssueCursor, IssueFilter, IssueSortOption, IssueStatusBucket } from '@/types';

export function buildIssueBucketQuery(
  _database: unknown,
  activeFilter: IssueFilter,
  uid: string,
  statusBucket: IssueStatusBucket,
  pageSize: number,
  isAdmin = false,
  cursor?: IssueCursor | null,
  sort: IssueSortOption = 'latest',
) {
  return { activeFilter, cursor, isAdmin, pageSize, sort, statusBucket, uid };
}
