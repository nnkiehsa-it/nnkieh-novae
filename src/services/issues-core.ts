import type { IssueRecord } from '@/types';
import { invokeBackendAction } from '@/services/backend-action';
import { READ_REQUEST_TIMEOUT_MS, RequestFailure } from '@/lib/request';
import { createContentCacheKey, getCachedContent, getCachedContentPersistent, runCoalescedContentRequest, setCachedContentFromRead } from '@/services/content-read-cache';
import {
  STATUS_BUCKETS,
  TABLE_PAGE_SIZE,
} from './issues-constants';
import {
  normalizeDate,
  normalizeIssueCursor,
  normalizeIssueRecord,
  normalizeIssueSummary,
  normalizeStatus,
  withSupportState,
} from './issues-normalize';
import { isContentUnavailableError, toReadableBackendError } from './issues-errors';

export {
  STATUS_BUCKETS,
  TABLE_PAGE_SIZE,
  normalizeDate,
  normalizeIssueCursor,
  normalizeIssueRecord,
  normalizeIssueSummary,
  normalizeStatus,
  isContentUnavailableError,
  toReadableBackendError,
  withSupportState,
};

export async function fetchIssueRecordById(
  issueId: string,
  options: { cacheScope?: string; forceRefresh?: boolean } = {},
): Promise<IssueRecord> {
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
    if (!isContentUnavailableError(error)) throw toReadableBackendError(error);
    throw new Error('issue.thisProposalCannotBeFound', { cause: error });
  } });
}

export function peekIssueRecordById(
  issueId: string,
  cacheScope: string | undefined,
) {
  return getCachedContent<IssueRecord>(
    createContentCacheKey(['issue-detail', issueId, cacheScope ?? 'default']),
  );
}
