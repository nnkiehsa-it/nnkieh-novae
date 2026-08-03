import { describe, expect, it } from 'vitest';
import { sortIssues } from '@/lib/issue-sort';
import type { IssueRecord, IssueStatus } from '@/types';

function issue(id: string, status: IssueStatus): IssueRecord {
  return {
    id,
    title: id,
    content: '',
    created_at: new Date('2026-08-03T00:00:00Z'),
    closed_at: status === 'completed' ? new Date('2026-08-03T01:00:00Z') : null,
    support_count: 0,
    status,
    category: 'general',
    read_access: 'school',
    comments_enabled: status !== 'completed',
    support_enabled: false,
    support_goal: null,
    support_deadline_at: null,
    response_deadline_at: null,
    review_approved_at: null,
    support_met_at: null,
    isOwnIssue: false,
    canManageIssue: false,
    canViewAuthor: true,
    author_uid: 'author',
  };
}

describe('sortIssues', () => {
  it('never keeps a closed proposal in an active bucket or an active proposal in a closed bucket', () => {
    const mixed = [issue('processing', 'processing'), issue('completed', 'completed')];

    expect(sortIssues(mixed, 'active', 'latest').map((item) => item.id)).toEqual(['processing']);
    expect(sortIssues(mixed, 'closed', 'latest').map((item) => item.id)).toEqual(['completed']);
  });
});
