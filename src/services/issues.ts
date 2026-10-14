import type { ActionOutput, ActionRequest } from '@shared/actions.ts';
import type { CommentCursor, CommentSort } from '@shared/contracts/discussions.ts';
import type { IssueCursor, IssueStatus, IssueSummary } from '@shared/contracts/issues.ts';
import { callAction } from '@/services/backend-action';
import { isContentUnavailableError, toReadableBackendError } from '@/services/backend-errors';
import {
  captureContentCacheWriteGuard,
  createContentCacheKey,
  getCachedContent,
  getCachedContentPersistent,
  markContentCachePrefixStale,
  runCoalescedContentRequest,
  setCachedContentFromRead,
} from '@/services/content-read-cache';
import { registerContentVersion } from '@/services/content-versions';
import { readRequestTimeoutMs, RequestFailure } from '@/lib/request';
import { getRouteRequestSignal } from '@/lib/route-request';
import type { IssueRecord } from '@/types';

interface ReadOptions {
  forceRefresh?: boolean;
  signal?: AbortSignal;
  /** Proposals this tab has supported since its pages were cached. */
  supportedIssueIds?: Set<string>;
}

function withSupportState<T extends { issues: IssueSummary[] }>(page: T, supportedIssueIds?: Set<string>): T {
  if (!supportedIssueIds) return page;
  return {
    ...page,
    issues: page.issues.map((issue) => supportedIssueIds.has(issue.id) ? { ...issue, currentUserSupported: true } : issue),
  };
}

function cursorKey(cursor: IssueCursor | null | undefined) {
  return [cursor?.id ?? 'first', cursor?.createdAt ?? '', cursor?.sortDate ?? '', cursor?.sortNumber ?? ''];
}

/** A cached page if there is one, or the page the action answers, cached for next time. */
async function readPage<N extends 'listIssues' | 'searchIssues' | 'listUserIssues'>(
  name: N,
  cacheKey: string,
  input: ActionRequest<N>,
  options: ReadOptions,
): Promise<ActionOutput<N>> {
  const cached = options.forceRefresh ? null : await getCachedContentPersistent<ActionOutput<N>>(cacheKey);
  if (cached) {
    registerContentVersion('issues', cached.version);
    return withSupportState(cached, options.supportedIssueIds);
  }
  const cacheGuard = captureContentCacheWriteGuard(cacheKey);
  try {
    const page = await callAction(name, input, { signal: options.signal, timeoutMs: readRequestTimeoutMs });
    setCachedContentFromRead(cacheGuard, page);
    registerContentVersion('issues', page.version);
    return withSupportState(page, options.supportedIssueIds);
  } catch (error) {
    throw toReadableBackendError(error);
  }
}

type IssueListRequest = Omit<ActionRequest<'listIssues'>, 'pageSize'>;

export function listIssues(input: IssueListRequest, options: ReadOptions & { pageSize?: number } = {}) {
  const pageSize = options.pageSize ?? 20;
  const cacheKey = createContentCacheKey([
    'issue-list-page', input.category, input.statusBucket ?? 'active', input.sort ?? 'latest', pageSize, ...cursorKey(input.cursor),
  ]);
  return readPage('listIssues', cacheKey, { ...input, pageSize }, options);
}

export function searchIssues(input: Omit<ActionRequest<'searchIssues'>, 'pageSize'>, options: ReadOptions = {}) {
  const query = input.query.trim();
  const cacheKey = createContentCacheKey([
    'issue-search', input.category, input.statusBucket ?? 'active', input.sort ?? 'latest', query, ...cursorKey(input.cursor),
  ]);
  return readPage('searchIssues', cacheKey, { ...input, query, pageSize: 30 }, options);
}

export function listUserIssues(input: Omit<ActionRequest<'listUserIssues'>, 'pageSize'>, options: ReadOptions = {}) {
  const query = input.query?.trim() ?? '';
  const cacheKey = createContentCacheKey([
    'user-issue-list-page', input.statusBucket ?? 'active', input.sort ?? 'latest', query, ...cursorKey(input.cursor),
  ]);
  return readPage('listUserIssues', cacheKey, { ...input, query, pageSize: 30 }, options);
}

/** How many proposals of a category are in each status, as the first page of its list reports them. */
export async function getIssueStatusCounts(category: string, options: ReadOptions = {}) {
  const { statusCounts } = await listIssues({ category }, { ...options, pageSize: 1 });
  if (!statusCounts) throw new Error('A first issue page arrived without its status counts.');
  return statusCounts;
}

function detailKey(issueId: string, cacheScope: string | undefined) {
  return createContentCacheKey(['issue-detail', issueId, cacheScope ?? 'default']);
}

export async function getIssue(issueId: string, options: { cacheScope?: string; forceRefresh?: boolean } = {}): Promise<IssueRecord> {
  const cacheKey = detailKey(issueId, options.cacheScope);
  if (!options.forceRefresh) {
    const cached = await getCachedContentPersistent<IssueRecord>(cacheKey);
    if (cached) return cached;
  }
  return runCoalescedContentRequest(cacheKey, async (cacheGuard) => {
    try {
      const { issue, canDeleteIssue } = await callAction('getIssue', { issueId }, { timeoutMs: readRequestTimeoutMs });
      const record = { ...issue, canDeleteIssue };
      setCachedContentFromRead(cacheGuard, record);
      return record;
    } catch (error) {
      if (error instanceof RequestFailure) throw error;
      if (isContentUnavailableError(error)) throw new Error('issue.thisProposalCannotBeFound', { cause: error });
      throw toReadableBackendError(error);
    }
  });
}

export function peekIssue(issueId: string, cacheScope: string | undefined) {
  return getCachedContent<IssueRecord>(detailKey(issueId, cacheScope));
}

export async function listIssueSupporters(issueId: string) {
  try {
    return (await callAction('listIssueSupporters', { issueId }, { timeoutMs: readRequestTimeoutMs })).supporters;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}

export async function listComments(
  issueId: string,
  cursor: CommentCursor | null,
  sort: CommentSort,
  options: { cacheScope?: string; forceRefresh?: boolean } = {},
) {
  const cacheKey = createContentCacheKey([
    'issue-comments-page', issueId, options.cacheScope ?? 'default', sort, cursor?.id ?? 'first', cursor?.createdAt ?? '',
  ]);
  if (!options.forceRefresh) {
    const cached = await getCachedContentPersistent<ActionOutput<'listComments'>>(cacheKey);
    if (cached) {
      registerContentVersion('issues', cached.version);
      return cached;
    }
  }
  const cacheGuard = captureContentCacheWriteGuard(cacheKey);
  try {
    const page = await callAction('listComments', { issueId, cursor, sort }, {
      signal: getRouteRequestSignal(),
      timeoutMs: readRequestTimeoutMs,
    });
    setCachedContentFromRead(cacheGuard, page);
    registerContentVersion('issues', page.version);
    return page;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}

function markIssuesStale(issueId?: string) {
  markContentCachePrefixStale('issue-list-page|');
  markContentCachePrefixStale('issue-search|');
  markContentCachePrefixStale('user-issue-list-page|');
  if (issueId) markContentCachePrefixStale(`issue-detail|${issueId}|`);
}

export async function createIssue(input: ActionRequest<'createIssue'>) {
  try {
    const { issue } = await callAction('createIssue', input);
    markIssuesStale(issue.id);
    return issue;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}

export async function moderateIssueStatus(issueId: string, status: IssueStatus, details: { reason?: string; resultContent?: string } = {}) {
  try {
    const { issue } = await callAction('moderateIssueStatus', { issueId, status, ...details });
    markIssuesStale(issueId);
    return issue;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}

export async function setSupport(issueId: string, supported: boolean) {
  try {
    const result = await callAction(supported ? 'toggleSupport' : 'removeSupport', { issueId });
    markIssuesStale(issueId);
    return result;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}

export async function deleteIssue(issueId: string) {
  try {
    await callAction('deleteIssue', { issueId });
    markIssuesStale(issueId);
  } catch (error) {
    throw toReadableBackendError(error);
  }
}

export async function createComment(issueId: string, content: string, parentCommentId: string | null) {
  try {
    const { comment } = await callAction('createComment', { issueId, content, parentCommentId });
    markContentCachePrefixStale(`issue-comments-page|${issueId}|`);
    markIssuesStale(issueId);
    return comment;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}

export async function deleteComment(issueId: string, commentId: string) {
  try {
    await callAction('deleteComment', { commentId });
    markContentCachePrefixStale(`issue-comments-page|${issueId}|`);
  } catch (error) {
    throw toReadableBackendError(error);
  }
}
