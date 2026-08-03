import type { IssueRecord, IssueSortOption, IssueStatusBucket } from '@/types';
import { getIssueStatusBucket } from '@/lib/issue-timeline';

function dateValue(value: Date | null | undefined) {
  return value?.getTime() ?? 0;
}

function descendingId(left: IssueRecord, right: IssueRecord) {
  return right.id.localeCompare(left.id);
}

export function issueEffectiveSortTime(issue: IssueRecord, statusBucket: IssueStatusBucket) {
  return statusBucket === 'closed'
    ? dateValue(issue.closed_at ?? issue.created_at)
    : dateValue(issue.review_approved_at ?? issue.created_at);
}

export function sortIssues(
  issues: IssueRecord[],
  statusBucket: IssueStatusBucket,
  sortOption: IssueSortOption,
) {
  return issues.filter((issue) => getIssueStatusBucket(issue) === statusBucket).sort((left, right) => {
    if (sortOption === 'most-supported') {
      const supportDifference = right.support_count - left.support_count;
      if (supportDifference !== 0) return supportDifference;
    }

    if (sortOption === 'ending-soon') {
      const leftDeadline = left.support_deadline_at?.getTime();
      const rightDeadline = right.support_deadline_at?.getTime();
      if (leftDeadline === undefined && rightDeadline !== undefined) return 1;
      if (leftDeadline !== undefined && rightDeadline === undefined) return -1;
      if (leftDeadline !== undefined && rightDeadline !== undefined && leftDeadline !== rightDeadline) {
        return leftDeadline - rightDeadline;
      }
      const createdDifference = dateValue(right.created_at) - dateValue(left.created_at);
      return createdDifference || descendingId(left, right);
    }

    const dateDifference = issueEffectiveSortTime(right, statusBucket)
      - issueEffectiveSortTime(left, statusBucket);
    return dateDifference || descendingId(left, right);
  });
}
