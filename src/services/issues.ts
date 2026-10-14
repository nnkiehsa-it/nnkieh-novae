import type { ActionOutput, ActionRequest } from '@shared/actions.ts';
import type { CommentCursor, CommentSort } from '@shared/contracts/discussions.ts';
import type { IssueStatus } from '@shared/contracts/issues.ts';
import { callAction } from '@/services/backend-action';
import { isContentUnavailableError, toReadableBackendError } from '@/services/backend-errors';
import { registerContentVersion } from '@/services/content-versions';
import { invalidate, invalidateLists, seedQuery } from '@/lib/query-client';
import { readRequestTimeoutMs, RequestFailure } from '@/lib/request';
import type { IssueRecord } from '@/types';

export const issueKeys = {
  list: (params: Record<string, string>) => ['issues', 'list', params] as const,
  counts: (category: string) => ['issues', 'list', 'counts', category] as const,
  detail: (issueId: string) => ['issues', 'detail', issueId] as const,
  comments: (issueId: string, sort: CommentSort) => ['issues', 'comments', issueId, sort] as const,
};

async function readPage<N extends 'listIssues' | 'searchIssues' | 'listUserIssues'>(
  name: N,
  input: ActionRequest<N>,
  signal?: AbortSignal,
): Promise<ActionOutput<N>> {
  try {
    const page = await callAction(name, input, { signal, timeoutMs: readRequestTimeoutMs });
    registerContentVersion('issues', page.version);
    return page;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}

export function listIssues(input: ActionRequest<'listIssues'>, signal?: AbortSignal) {
  return readPage('listIssues', input, signal);
}

export function searchIssues(input: ActionRequest<'searchIssues'>, signal?: AbortSignal) {
  return readPage('searchIssues', { ...input, query: input.query.trim(), pageSize: 30 }, signal);
}

export function listUserIssues(input: ActionRequest<'listUserIssues'>, signal?: AbortSignal) {
  return readPage('listUserIssues', { ...input, query: input.query?.trim() ?? '', pageSize: 30 }, signal);
}

/** How many proposals of a category are in each status, as the first page of its list reports them. */
export async function getIssueStatusCounts(category: string, signal?: AbortSignal) {
  const { statusCounts } = await listIssues({ category, pageSize: 1 }, signal);
  if (!statusCounts) throw new Error('A first issue page arrived without its status counts.');
  return statusCounts;
}

export async function getIssue(issueId: string, signal?: AbortSignal): Promise<IssueRecord> {
  try {
    const { issue, canDeleteIssue } = await callAction('getIssue', { issueId }, { signal, timeoutMs: readRequestTimeoutMs });
    return { ...issue, canDeleteIssue };
  } catch (error) {
    if (error instanceof RequestFailure) throw error;
    if (isContentUnavailableError(error)) throw new Error('issue.thisProposalCannotBeFound', { cause: error });
    throw toReadableBackendError(error);
  }
}

export async function listIssueSupporters(issueId: string) {
  try {
    return (await callAction('listIssueSupporters', { issueId }, { timeoutMs: readRequestTimeoutMs })).supporters;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}

export async function listComments(issueId: string, cursor: CommentCursor | null, sort: CommentSort, signal?: AbortSignal) {
  try {
    const page = await callAction('listComments', { issueId, cursor, sort }, { signal, timeoutMs: readRequestTimeoutMs });
    registerContentVersion('issues', page.version);
    return page;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}

/** What one change to a proposal makes stale: every list, and the proposal itself. */
function invalidateIssue(issueId?: string) {
  void invalidateLists('issues');
  if (issueId) void invalidate(issueKeys.detail(issueId));
}

export async function createIssue(input: ActionRequest<'createIssue'>) {
  try {
    const { issue } = await callAction('createIssue', input);
    seedQuery(issueKeys.detail(issue.id), issue);
    invalidateIssue();
    return issue;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}

export async function moderateIssueStatus(issueId: string, status: IssueStatus, details: { reason?: string; resultContent?: string } = {}) {
  try {
    const { issue } = await callAction('moderateIssueStatus', { issueId, status, ...details });
    invalidateIssue(issueId);
    return issue;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}

export async function setSupport(issueId: string, supported: boolean) {
  try {
    const result = await callAction(supported ? 'toggleSupport' : 'removeSupport', { issueId });
    invalidateIssue(issueId);
    return result;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}

export async function deleteIssue(issueId: string) {
  try {
    await callAction('deleteIssue', { issueId });
    void invalidateLists('issues');
  } catch (error) {
    throw toReadableBackendError(error);
  }
}

export async function createComment(issueId: string, content: string, parentCommentId: string | null) {
  try {
    const { comment } = await callAction('createComment', { issueId, content, parentCommentId });
    await invalidate(['issues', 'comments', issueId]);
    return comment;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}

export async function deleteComment(issueId: string, commentId: string) {
  try {
    await callAction('deleteComment', { commentId });
    await invalidate(['issues', 'comments', issueId]);
  } catch (error) {
    throw toReadableBackendError(error);
  }
}
