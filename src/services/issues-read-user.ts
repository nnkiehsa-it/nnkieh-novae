import { READ_REQUEST_TIMEOUT_MS } from '@/lib/request';
import { invokeBackendAction } from '@/services/backend-action';
import { captureContentCacheWriteGuard, createContentCacheKey, getCachedContentPersistent, setCachedContentFromRead } from '@/services/content-read-cache';
import type { IssueCursor, IssueSortOption, IssueStatusBucket, IssueSummary } from '@/types';
import { normalizeIssueCursor, normalizeIssueSummary, toReadableBackendError, withSupportState } from './issues-core';
import { registerContentVersion } from '@/services/content-versions';

function issueCursorPayload(cursor: IssueCursor | null) {
  return cursor ? {
    createdAt: cursor.created_at?.toISOString() ?? null,
    id: cursor.id,
    sortDate: cursor.sort_date?.toISOString() ?? null,
    sortNumber: cursor.sort_number,
  } : null;
}

export async function fetchUserIssues(
  uid: string,
  cursor: IssueCursor | null,
  options?: {
    forceRefresh?: boolean;
    pageSize?: number;
    sort?: IssueSortOption;
    statusBucket?: IssueStatusBucket;
    supportedIssueIds?: Set<string>;
    signal?: AbortSignal;
  },
) {
  const pageSize = options?.pageSize ?? 30;
  const sort = options?.sort ?? 'latest';
  const statusBucket = options?.statusBucket ?? 'active';
  const cacheKey = createContentCacheKey([
    'user-issue-list-page',
    'summary-v2',
    uid,
    statusBucket,
    sort,
    pageSize,
    cursor?.id ?? 'first',
    cursor?.sort_number ?? '',
    cursor?.sort_date?.getTime() ?? '',
    cursor?.created_at?.getTime() ?? '',
  ]);
  if (!options?.forceRefresh) {
    const cached = await getCachedContentPersistent<{ cursor: IssueCursor | null; hasMore: boolean; issues: IssueSummary[]; version: number }>(cacheKey);
    if (cached) {
      registerContentVersion('issues', cached.version ?? 1);
      return {
        ...cached,
        issues: withSupportState(cached.issues, options?.supportedIssueIds),
      };
    }
  }
  const cacheGuard = captureContentCacheWriteGuard(cacheKey);

  try {
    const fn = invokeBackendAction<
      { cursor: ReturnType<typeof issueCursorPayload>; pageSize: number; sort: IssueSortOption; statusBucket: IssueStatusBucket; uid: string },
      { cursor: IssueCursor | null; hasMore: boolean; issues: Record<string, unknown>[]; version: number }
    >('listUserIssues', {
      signal: options?.signal,
      timeoutMs: READ_REQUEST_TIMEOUT_MS,
    });
    const result = await fn({ cursor: issueCursorPayload(cursor), pageSize, sort, statusBucket, uid });
    const issues = result.issues.map((issue) => normalizeIssueSummary(String(issue.id ?? ''), issue));
    const page = {
      cursor: normalizeIssueCursor(result.cursor),
      hasMore: result.hasMore,
      issues: withSupportState(issues, options?.supportedIssueIds),
      version: result.version,
    };
    setCachedContentFromRead(cacheGuard, page);
    registerContentVersion('issues', result.version);
    return page;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}
