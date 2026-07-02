import type { IssueRecord, IssueStatus } from '@/types';
import { getIssueSupportGoal, issueAutoRejectsUnmetSupport } from '@/constants/categories';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

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

export function getRemainingCalendarDays(deadline: Date | null, today = new Date()): number | null {
  if (!deadline) {
    return null;
  }

  const deadlineDate = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.ceil((deadlineDate.getTime() - todayDate.getTime()) / MILLISECONDS_PER_DAY);
}

export function getSupportProgressPercent(supportCount: number, supportGoal: number | null): number {
  if (!supportGoal || supportGoal <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, (supportCount / supportGoal) * 100));
}

export function getSupportRemainingLabel(remainingDays: number | null): string {
  if (remainingDays === null) {
    return '';
  }
  if (remainingDays < 0) {
    return '附議已截止';
  }
  if (remainingDays === 0) {
    return '今天截止';
  }
  return `剩 ${remainingDays} 天`;
}
