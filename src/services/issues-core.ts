import type { IssueRecord } from '@/types';
import { invokeBackendAction } from '@/services/backend-action';
import { READ_REQUEST_TIMEOUT_MS, RequestFailure } from '@/lib/request';
import { createContentCacheKey, getCachedContentPersistent, runCoalescedContentRequest, setCachedContentFromRead } from '@/services/content-read-cache';
import {
  STATUS_BUCKETS,
  TABLE_PAGE_SIZE,
} from './issues-constants';
import {
  normalizeDate,
  normalizeIssueCursor,
  normalizeIssueRecord,
  normalizeStatus,
  withSupportState,
} from './issues-normalize';
import { isContentUnavailableError, toReadableBackendError } from './issues-errors';
import { prepareContentRevisionRead } from '@/services/content-revisions';

export {
  STATUS_BUCKETS,
  TABLE_PAGE_SIZE,
  normalizeDate,
  normalizeIssueCursor,
  normalizeIssueRecord,
  normalizeStatus,
  isContentUnavailableError,
  toReadableBackendError,
  withSupportState,
};

export async function fetchIssueRecordById(
  issueId: string,
  options: { cacheScope?: string; forceRefresh?: boolean } = {},
): Promise<IssueRecord> {
  if (!options.forceRefresh) await prepareContentRevisionRead();
  const cacheKey = createContentCacheKey(['issue-detail', issueId, options.cacheScope ?? 'default']);
  if (!options.forceRefresh) {
    const cached = await getCachedContentPersistent<IssueRecord>(cacheKey);
    if (cached) return cached;
  }

  return runCoalescedContentRequest(cacheKey, async (cacheGuard) => { try {
    const fn = invokeBackendAction<{ issueId: string }, { issue: Record<string, unknown> }>('getIssue', {
      timeoutMs: READ_REQUEST_TIMEOUT_MS,
    });
    const result = await fn({ issueId });
    const issue = normalizeIssueRecord(String(result.issue.id ?? issueId), result.issue);
    setCachedContentFromRead(cacheGuard, issue);
    return issue;
  } catch (error) {
    if (error instanceof RequestFailure) throw error;
    throw new Error('issue.thisProposalCannotBeFound', { cause: error });
  } });
}
