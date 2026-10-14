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
  const items: Array<{ label: string; shortLabel: string; value: Date | null | undefined }> = [
    { label: 'issue.proposalSubmitted', shortLabel: 'issue.proposal', value: issue.created_at },
    { label: 'issue.approvalTime', shortLabel: 'issue.approved', value: issue.review_approved_at },
    { label: 'issue.supportDeadlineLabel', shortLabel: 'issue.supportDeadline', value: issue.support_deadline_at },
    { label: 'issue.timeToReachTheStandard', shortLabel: 'issue.meetTheStandard', value: issue.support_met_at },
    { label: 'issue.caseClosingTime', shortLabel: 'issue.closeTheCase', value: issue.closed_at },
  ];

  return items.filter((item): item is RawIssueTimeItem => item.value instanceof Date);
}
