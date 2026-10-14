import type { IssueOperationTimeItem, IssueRecord, IssueStatus } from '@/types';

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

export function getIssueOperationTimeItems(issue: IssueRecord): RawIssueTimeItem[] {
  const items: Array<{ label: string; shortLabel: string; value: string | null }> = [
    { label: 'issue.proposalSubmitted', shortLabel: 'issue.proposal', value: issue.createdAt },
    { label: 'issue.approvalTime', shortLabel: 'issue.approved', value: issue.reviewApprovedAt },
    { label: 'issue.supportDeadlineLabel', shortLabel: 'issue.supportDeadline', value: issue.supportDeadlineAt },
    { label: 'issue.timeToReachTheStandard', shortLabel: 'issue.meetTheStandard', value: issue.supportMetAt },
    { label: 'issue.caseClosingTime', shortLabel: 'issue.closeTheCase', value: issue.closedAt },
  ];

  return items.flatMap(({ value, ...item }) => value === null ? [] : [{ ...item, value: new Date(value) }]);
}
