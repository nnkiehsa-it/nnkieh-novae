import type { IssueRecord } from '@/types';
import { isClosedIssueStatus } from '@/lib/issue-timeline';

type IssueNoticeTone = 'error' | 'success';

interface IssueNotice {
  content: string;
  title: string;
  tone: IssueNoticeTone;
}

export function getIssueNotice(
  issue: Pick<IssueRecord, 'resultContent' | 'reviewRejectionReason' | 'status'>,
  statusFallback = '',
): IssueNotice | null {
  if (!isClosedIssueStatus(issue.status)) return null;

  if (issue.status === 'review-rejected' || issue.status === 'infeasible' || issue.status === 'auto-rejected') {
    return {
      content:
        (issue.status === 'review-rejected'
          ? issue.reviewRejectionReason || issue.resultContent
          : issue.resultContent || issue.reviewRejectionReason) || statusFallback,
      title: 'issue.reasonForRejection',
      tone: 'error',
    };
  }

  return {
    content: issue.resultContent || statusFallback,
    title: 'issue.result',
    tone: 'success',
  };
}
