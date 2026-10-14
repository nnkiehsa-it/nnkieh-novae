import type { IssueRecord, IssueStatus } from '@/types';
import { getIssueSupportGoal, issueAutoRejectsUnmetSupport } from '@/constants/categories';

function isExpiredUnmetPublicIssue(issue: Pick<
  IssueRecord,
  'category' | 'status' | 'supportMetAt' | 'supportDeadlineAt' | 'supportGoal' | 'supportCount'
>) {
  if (
    !issueAutoRejectsUnmetSupport(issue.category)
    || issue.status !== 'pending'
    || issue.supportMetAt
    || !issue.supportDeadlineAt
  ) {
    return false;
  }

  const goal = issue.supportGoal ?? getIssueSupportGoal(issue.category);
  if (goal === null) {
    return false;
  }
  return Date.parse(issue.supportDeadlineAt) <= Date.now() && issue.supportCount < goal;
}

export function getDerivedIssueStatus(issue: Pick<
  IssueRecord,
  'category' | 'status' | 'supportMetAt' | 'supportDeadlineAt' | 'supportGoal' | 'supportCount'
>): IssueStatus {
  return isExpiredUnmetPublicIssue(issue) ? 'auto-rejected' : issue.status;
}

export function getSupportProgressPercent(supportCount: number, supportGoal: number | null): number {
  if (!supportGoal || supportGoal <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, (supportCount / supportGoal) * 100));
}

