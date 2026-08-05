import type { IssueRecord } from '@/types';
import { isClosedIssueStatus } from '@/lib/issue-timeline';

export type IssueNoticeTone = 'error' | 'success';

export interface IssueNotice {
  content: string;
  title: string;
  tone: IssueNoticeTone;
}

export function getIssueNotice(
  issue: Pick<IssueRecord, 'result_content' | 'review_rejection_reason' | 'status'>,
  statusFallback = '',
): IssueNotice | null {
  if (!isClosedIssueStatus(issue.status)) return null;

  if (issue.status === 'review-rejected' || issue.status === 'infeasible' || issue.status === 'auto-rejected') {
    return {
      content:
        (issue.status === 'review-rejected'
          ? issue.review_rejection_reason || issue.result_content
          : issue.result_content || issue.review_rejection_reason) || statusFallback,
      title: 'issue.reasonForRejection',
      tone: 'error',
    };
  }

  return {
    content: issue.result_content || statusFallback,
    title: 'issue.result',
    tone: 'success',
  };
}
