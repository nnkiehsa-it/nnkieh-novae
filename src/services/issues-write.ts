import type {
  CommentRecord,
  CommentInput,
  ComposerInput,
  DiscussionCommentRecord,
  IssueRecord,
  IssueStatus,
} from '@/types';
import { invokeBackendAction } from '@/services/backend-action';
import { createRequestId } from '@/lib/request-id';
import { markContentCachePrefixStale } from '@/services/content-read-cache';
import {
  normalizeIssueRecord,
  toReadableBackendError,
} from './issues-core';
import type { CommentResponseRecord } from './issues-read-shared';
import type { IssueReadAccess } from '@/types/categories';

interface IssueResponseRecord {
  id: string;
  title: string;
  content: string;
  category: string;
  status: string;
  support_count: number;
  comments_enabled: boolean;
  read_access: IssueReadAccess;
  support_enabled: boolean;
  support_goal: number | null;
  created_at_ms: number | null;
  closed_at_ms: number | null;
  support_deadline_at_ms: number | null;
  response_deadline_at_ms: number | null;
  review_approved_at_ms: number | null;
  result_content?: string | null;
  support_met_at_ms: number | null;
  review_rejection_reason?: string;
  currentUserSupported?: boolean;
  isOwnIssue?: boolean;
  canManageIssue?: boolean;
  canViewAuthor?: boolean;
  author_uid?: string | null;
}

interface SupportResponse {
  success: boolean;
  supported: boolean;
  support_count: number;
}

function dateFromMs(value: number | null | undefined) {
  return typeof value === 'number' ? new Date(value) : null;
}

function normalizeIssueResponse(issue: IssueResponseRecord): IssueRecord {
  const record = normalizeIssueRecord(issue.id, {
    title: issue.title,
    content: issue.content,
    category: issue.category,
    status: issue.status,
    support_count: issue.support_count,
    comments_enabled: issue.comments_enabled,
    read_access: issue.read_access,
    support_enabled: issue.support_enabled,
    support_goal: issue.support_goal,
    created_at: dateFromMs(issue.created_at_ms),
    closed_at: dateFromMs(issue.closed_at_ms),
    support_deadline_at: dateFromMs(issue.support_deadline_at_ms),
    response_deadline_at: dateFromMs(issue.response_deadline_at_ms),
    review_approved_at: dateFromMs(issue.review_approved_at_ms),
    result_content: issue.result_content ?? undefined,
    support_met_at: dateFromMs(issue.support_met_at_ms),
    review_rejection_reason: issue.review_rejection_reason,
    currentUserSupported: issue.currentUserSupported,
    isOwnIssue: issue.isOwnIssue,
    canManageIssue: issue.canManageIssue,
    canViewAuthor: issue.canViewAuthor,
    author_uid: issue.author_uid,
  });
  return record;
}

function normalizeDiscussionCommentResponse(comment: CommentResponseRecord): DiscussionCommentRecord {
  return {
    id: comment.id,
    parent_comment_id: comment.parent_comment_id,
    content: comment.content,
    author_uid: comment.author_uid,
    created_at: dateFromMs(comment.created_at_ms),
    replies: (comment.replies ?? []).map(normalizeDiscussionCommentResponse),
  };
}

function normalizeCommentResponse(comment: CommentResponseRecord): CommentRecord {
  return {
    ...normalizeDiscussionCommentResponse(comment),
    issue_id: comment.issue_id,
  };
}

function invalidateIssueCache(issueId?: string) {
  markContentCachePrefixStale('issue-list-page|');
  markContentCachePrefixStale('issue-search|');
  markContentCachePrefixStale('user-issue-list-page|');
  if (issueId) markContentCachePrefixStale(`issue-detail|${issueId}|`);
}

export async function createIssue(
  input: ComposerInput,
) {
  try {
    const fn = invokeBackendAction<
      { title: string; content: string; category: string; requestId: string },
      { issue: IssueResponseRecord }
    >('createIssue');
    const result = await fn({
      title: input.title,
      content: input.content,
      category: input.category,
      requestId: createRequestId(),
    });
    invalidateIssueCache(result.issue.id);
    return normalizeIssueResponse(result.issue);
  } catch (error) {
    throw toReadableBackendError(error);
  }
}

export async function moderateIssueStatus(issueId: string, status: IssueStatus, reason?: string) {
  try {
    const fn = invokeBackendAction<
      { issueId: string; status: IssueStatus; reason?: string; requestId: string },
      { issue: IssueResponseRecord }
    >('moderateIssueStatus');
    const result = await fn({ issueId, status, reason, requestId: createRequestId() });
    invalidateIssueCache(issueId);
    return normalizeIssueResponse(result.issue);
  } catch (error) {
    throw toReadableBackendError(error);
  }
}

export async function updateIssueResult(issueId: string, resultContent: string) {
  try {
    const fn = invokeBackendAction<
      { issueId: string; resultContent: string; requestId: string },
      { issue: IssueResponseRecord }
    >('updateIssueResult');
    const result = await fn({ issueId, resultContent, requestId: createRequestId() });
    invalidateIssueCache(issueId);
    return normalizeIssueResponse(result.issue);
  } catch (error) {
    throw toReadableBackendError(error);
  }
}

export async function setIssueCommentsEnabled(issueId: string, enabled: boolean) {
  try {
    const fn = invokeBackendAction<
      { issueId: string; enabled: boolean; requestId: string },
      { issue: IssueResponseRecord }
    >('setIssueCommentsEnabled');
    const result = await fn({ issueId, enabled, requestId: createRequestId() });
    invalidateIssueCache(issueId);
    return normalizeIssueResponse(result.issue);
  } catch (error) {
    throw toReadableBackendError(error);
  }
}

export async function toggleSupport(
  issueId: string,
) {
  try {
    const fn = invokeBackendAction<{ issueId: string; requestId: string }, SupportResponse>('toggleSupport');
    const result = await fn({ issueId, requestId: createRequestId() });
    invalidateIssueCache(issueId);
    return result;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}

export async function removeSupport(issueId: string) {
  try {
    const fn = invokeBackendAction<{ issueId: string; requestId: string }, SupportResponse>('removeSupport');
    const result = await fn({ issueId, requestId: createRequestId() });
    invalidateIssueCache(issueId);
    return result;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}

export async function deleteIssue(
  issueId: string,
) {
  try {
    const fn = invokeBackendAction<{ issueId: string; requestId: string }, { success: boolean; issueId: string }>('deleteIssue');
    const result = await fn({ issueId, requestId: createRequestId() });
    invalidateIssueCache(issueId);
    return result;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}

export async function createComment(
  issueId: string,
  input: CommentInput,
  parentCommentId: string | null = null,
) {
  try {
    const fn = invokeBackendAction<
      { issueId: string; content: string; parentCommentId?: string | null; requestId: string },
      { comment: CommentResponseRecord }
    >('createComment');
    const result = await fn({
      issueId,
      content: input.content,
      parentCommentId,
      requestId: createRequestId(),
    });
    const comment = normalizeCommentResponse(result.comment);
    markContentCachePrefixStale(`issue-comments-page|${issueId}|`);
    invalidateIssueCache(issueId);
    return comment;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}

export async function deleteComment(commentId: string) {
  try {
    const fn = invokeBackendAction('deleteComment');
    await fn({ commentId, requestId: createRequestId() });
    markContentCachePrefixStale('issue-comments-page|');
  } catch (error) {
    throw toReadableBackendError(error);
  }
}
