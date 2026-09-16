import type { IssueOperationTimeItem, IssueRecord, IssueSortOption, IssueStatus, IssueStatusBucket } from '@/types';

type RawIssueTimeItem = Omit<IssueOperationTimeItem, 'valueLabel'>;

const CLOSED_STATUSES = new Set<IssueStatus>([
  'auto-rejected',
  'review-rejected',
  'infeasible',
  'completed',
]);

export function isClosedIssueStatus(status: IssueStatus) {
  return CLOSED_STATUSES.has(status);
}

export function getIssueStatusBucket(issue: Pick<IssueRecord, 'status'>): IssueStatusBucket {
  return isClosedIssueStatus(issue.status) ? 'closed' : 'active';
}

export function getIssueLatestSortTime(
  issue: Pick<IssueRecord, 'closed_at' | 'created_at' | 'review_approved_at' | 'status'>,
  statusBucket: IssueStatusBucket,
) {
  if (statusBucket === 'closed' || isClosedIssueStatus(issue.status)) {
    return issue.closed_at?.getTime() ?? issue.created_at?.getTime() ?? 0;
  }
  return issue.review_approved_at?.getTime() ?? issue.created_at?.getTime() ?? 0;
}

export function sortIssuesByOption(
  issues: IssueRecord[],
  sortOption: IssueSortOption,
  statusBucket: IssueStatusBucket,
) {
  return [...issues].sort((left, right) => {
    const leftSortAt = getIssueLatestSortTime(left, statusBucket);
    const rightSortAt = getIssueLatestSortTime(right, statusBucket);

    if (sortOption === 'most-supported') {
      return right.support_count - left.support_count || rightSortAt - leftSortAt;
    }

    if (sortOption === 'ending-soon') {
      return (left.support_deadline_at?.getTime() ?? Number.POSITIVE_INFINITY)
        - (right.support_deadline_at?.getTime() ?? Number.POSITIVE_INFINITY)
        || rightSortAt - leftSortAt;
    }

    return rightSortAt - leftSortAt;
  });
}

export function sortMixedStatusIssuesByOption(
  issues: IssueRecord[],
  sortOption: IssueSortOption,
) {
  return [...issues].sort((left, right) => {
    const leftSortAt = getIssueLatestSortTime(left, getIssueStatusBucket(left));
    const rightSortAt = getIssueLatestSortTime(right, getIssueStatusBucket(right));

    if (sortOption === 'most-supported') {
      return right.support_count - left.support_count || rightSortAt - leftSortAt;
    }

    if (sortOption === 'ending-soon') {
      return (left.support_deadline_at?.getTime() ?? Number.POSITIVE_INFINITY)
        - (right.support_deadline_at?.getTime() ?? Number.POSITIVE_INFINITY)
        || rightSortAt - leftSortAt;
    }

    return rightSortAt - leftSortAt;
  });
}

export function getIssueOperationTimeItems(issue: IssueRecord): RawIssueTimeItem[] {
  const items: Array<{ label: string; shortLabel: string; value: Date | null | undefined }> = [
    { label: 'issue.proposalSubmitted', shortLabel: 'issue.proposal', value: issue.created_at },
    { label: 'issue.approvalTime', shortLabel: 'issue.approved', value: issue.review_approved_at },
    { label: 'issue.supportDeadlineLabel', shortLabel: 'issue.supportDeadline', value: issue.support_deadline_at },
    { label: 'issue.timeToReachTheStandard', shortLabel: 'issue.meetTheStandard', value: issue.support_met_at },
    { label: 'issue.caseClosingTime', shortLabel: 'issue.closeTheCase', value: issue.closed_at },
  ];

  return items.filter((item): item is RawIssueTimeItem => item.value instanceof Date);
}
