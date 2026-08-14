import type { IssueCursor, IssueFilter, IssueSortOption, IssueStatusBucket, IssueSummary } from '@/types';
import { buildTitleSearchTokens, normalizeSearchText } from '@/lib/search';
import { READ_REQUEST_TIMEOUT_MS } from '@/lib/request';
import { invokeBackendAction } from '@/services/backend-action';
import { captureContentCacheWriteGuard, createContentCacheKey, getCachedContentPersistent, setCachedContentFromRead } from '@/services/content-read-cache';
import { TABLE_PAGE_SIZE, normalizeIssueCursor, normalizeIssueSummary, toReadableBackendError, withSupportState } from './issues-core';
import { CONTENT_FEED_PAGE_SIZE } from '@/lib/page-size';
import { registerContentVersion } from '@/services/content-versions';

function normalizeIssueList(records: Record<string, unknown>[]) {
  return records.map((record) => normalizeIssueSummary(String(record.id ?? ''), record));
}

export async function fetchIssuesPageByStatus(
  uid: string,
  activeFilter: IssueFilter,
  statusBucket: IssueStatusBucket,
  cursor: IssueCursor | null,
  options?: {
    forceRefresh?: boolean;
    isAdmin?: boolean;
    signal?: AbortSignal;
    pageSize?: number;
    sort?: IssueSortOption;
    supportedIssueIds?: Set<string>;
  },
) {
  const pageSize = options?.pageSize ?? TABLE_PAGE_SIZE;
  const cacheKey = createContentCacheKey([
    'issue-list-page',
    'summary-v2',
    uid,
    options?.isAdmin ? 'admin' : 'user',
    activeFilter,
    statusBucket,
    options?.sort ?? 'latest',
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
      {
        activeFilter: IssueFilter;
        cursor: IssueCursor | null;
        isAdmin: boolean;
        pageSize: number;
        sort: IssueSortOption;
        statusBucket: IssueStatusBucket;
        uid: string;
      },
      { cursor: IssueCursor | null; hasMore: boolean; issues: Record<string, unknown>[]; version: number }
    >('listIssues', { signal: options?.signal, timeoutMs: READ_REQUEST_TIMEOUT_MS });
    const result = await fn({
      activeFilter,
      cursor,
      isAdmin: options?.isAdmin ?? false,
      pageSize,
      sort: options?.sort ?? 'latest',
      statusBucket,
      uid,
    });
    const page = {
      cursor: normalizeIssueCursor(result.cursor),
      hasMore: result.hasMore,
      issues: withSupportState(normalizeIssueList(result.issues), options?.supportedIssueIds),
      version: result.version,
    };
    setCachedContentFromRead(cacheGuard, page);
    registerContentVersion('issues', result.version);
    return page;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}

export async function fetchIssuesForTitleSearch(
  uid: string,
  activeFilter: IssueFilter,
  statusBucket: IssueStatusBucket,
  titleQuery: string,
  options?: {
    cursor?: IssueCursor | null;
    forceRefresh?: boolean;
    isAdmin?: boolean;
    signal?: AbortSignal;
    sort?: IssueSortOption;
    supportedIssueIds?: Set<string>;
  },
): Promise<{
  cursor: IssueCursor | null;
  hasMore: boolean;
  issues: IssueSummary[];
  limited: boolean;
  version: number;
}> {
  const normalizedQuery = normalizeSearchText(titleQuery);
  const searchTokens = buildTitleSearchTokens(normalizedQuery);
  if (searchTokens.length === 0) {
    return { cursor: null, hasMore: false, issues: [], limited: false, version: 0 };
  }
  const cacheKey = createContentCacheKey([
    'issue-search',
    'summary-v2',
    uid,
    options?.isAdmin ? 'admin' : 'user',
    activeFilter,
    statusBucket,
    options?.sort ?? 'latest',
    normalizedQuery,
    options?.cursor?.id ?? 'first',
    options?.cursor?.sort_number ?? '',
    options?.cursor?.sort_date?.getTime() ?? '',
    options?.cursor?.created_at?.getTime() ?? '',
  ]);
  if (!options?.forceRefresh) {
    const cached = await getCachedContentPersistent<{
      cursor: IssueCursor | null;
      hasMore: boolean;
      issues: IssueSummary[];
      limited: boolean;
      version: number;
    }>(cacheKey);
    if (cached) {
      registerContentVersion('issues', cached.version ?? 1);
      return {
        cursor: cached.cursor,
        hasMore: cached.hasMore,
        issues: withSupportState(cached.issues, options?.supportedIssueIds),
        limited: cached.limited,
        version: cached.version,
      };
    }
  }
  const cacheGuard = captureContentCacheWriteGuard(cacheKey);

  try {
    const fn = invokeBackendAction<
      {
        activeFilter: IssueFilter;
        cursor: IssueCursor | null;
        isAdmin: boolean;
        pageSize: number;
        sort: IssueSortOption;
        statusBucket: IssueStatusBucket;
        titleQuery: string;
        uid: string;
      },
      { cursor: IssueCursor | null; hasMore: boolean; issues: Record<string, unknown>[]; limited: boolean; version: number }
    >('searchIssues', { signal: options?.signal, timeoutMs: READ_REQUEST_TIMEOUT_MS });
    const result = await fn({
      activeFilter,
      cursor: options?.cursor ?? null,
      isAdmin: options?.isAdmin ?? false,
      pageSize: CONTENT_FEED_PAGE_SIZE,
      sort: options?.sort ?? 'latest',
      statusBucket,
      titleQuery,
      uid,
    });
    const page = {
      cursor: normalizeIssueCursor(result.cursor),
      hasMore: result.hasMore,
      issues: withSupportState(normalizeIssueList(result.issues), options?.supportedIssueIds),
      limited: result.limited,
      version: result.version,
    };
    setCachedContentFromRead(cacheGuard, page);
    registerContentVersion('issues', result.version);
    return page;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}
