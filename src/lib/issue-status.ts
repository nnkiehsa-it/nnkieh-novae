import type { IssueRecord, IssueStatus } from '@/types';
import { getIssueSupportGoal, issueAutoRejectsUnmetSupport } from '@/constants/categories';

function isExpiredUnmetPublicIssue(issue: Pick<
  IssueRecord,
  'category' | 'status' | 'support_met_at' | 'support_deadline_at' | 'support_goal' | 'support_count'
>) {
  if (
    !issueAutoRejectsUnmetSupport(issue.category)
    || issue.status !== 'pending'
    || issue.support_met_at
    || !issue.support_deadline_at
  ) {
    return false;
  }

  const goal = issue.support_goal ?? getIssueSupportGoal(issue.category);
  if (goal === null) {
    return false;
  }
  return issue.support_deadline_at.getTime() <= Date.now() && issue.support_count < goal;
}

export function getDerivedIssueStatus(issue: Pick<
  IssueRecord,
  'category' | 'status' | 'support_met_at' | 'support_deadline_at' | 'support_goal' | 'support_count'
>): IssueStatus {
  return isExpiredUnmetPublicIssue(issue) ? 'auto-rejected' : issue.status;
}

export function getSupportProgressPercent(supportCount: number, supportGoal: number | null): number {
  if (!supportGoal || supportGoal <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, (supportCount / supportGoal) * 100));
}

