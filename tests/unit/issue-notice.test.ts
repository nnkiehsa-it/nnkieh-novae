import { describe, expect, it } from 'vitest';
import { getIssueNotice } from '@/lib/issue-notice';

describe('getIssueNotice', () => {
  it('returns null for active issue status', () => {
    expect(getIssueNotice({ status: 'processing', result_content: null, review_rejection_reason: null })).toBeNull();
  });

  it('returns success tone and result title for completed issue', () => {
    const notice = getIssueNotice({ status: 'completed', result_content: '處理完成', review_rejection_reason: null });
    expect(notice).toEqual({
      content: '處理完成',
      title: 'issue.result',
      tone: 'success',
    });
  });

  it('returns error tone and reasonForRejection title for review-rejected issue', () => {
    const notice = getIssueNotice({ status: 'review-rejected', result_content: null, review_rejection_reason: '內容不合規' });
    expect(notice).toEqual({
      content: '內容不合規',
      title: 'issue.reasonForRejection',
      tone: 'error',
    });
  });

  it('returns error tone and reasonForRejection title for infeasible issue', () => {
    const notice = getIssueNotice({ status: 'infeasible', result_content: '預算不足無法實行', review_rejection_reason: null });
    expect(notice).toEqual({
      content: '預算不足無法實行',
      title: 'issue.reasonForRejection',
      tone: 'error',
    });
  });

  it('returns error tone and reasonForRejection title for auto-rejected issue', () => {
    const notice = getIssueNotice({ status: 'auto-rejected', result_content: null, review_rejection_reason: null }, '附議未達標');
    expect(notice).toEqual({
      content: '附議未達標',
      title: 'issue.reasonForRejection',
      tone: 'error',
    });
  });
});
