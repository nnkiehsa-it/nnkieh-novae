import type {
  CommentRecord,
  CommentInput,
  ComposerInput,
  DiscussionCommentRecord,
  IssueRecord,
  IssueStatus,
} from '@/types';
import { invokeBackendAction } from '@/services/backend-action';
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
  supportCount: number;
  commentsEnabled: boolean;
  readAccess: IssueReadAccess;
  supportEnabled: boolean;
  supportGoal: number | null;
  createdAt: string | null;
  closedAt: string | null;
  supportDeadlineAt: string | null;
  responseDeadlineAt: string | null;
  reviewApprovedAt: string | null;
  resultContent?: string | null;
  supportMetAt: string | null;
  reviewRejectionReason?: string;
  currentUserSupported?: boolean;
  isOwnIssue?: boolean;
  canManageIssue?: boolean;
  canViewAuthor?: boolean;
  authorUid?: string | null;
}

interface SupportResponse {
  success: boolean;
  supported: boolean;
  supportCount: number;
}

function dateFromApi(value: string | null | undefined) {
  return typeof value === 'string' ? new Date(value) : null;
}

function normalizeIssueResponse(issue: IssueResponseRecord): IssueRecord {
  const record = normalizeIssueRecord(issue.id, {
    title: issue.title,
    content: issue.content,
    category: issue.category,
    status: issue.status,
    support_count: issue.supportCount,
    comments_enabled: issue.commentsEnabled,
    read_access: issue.readAccess,
    support_enabled: issue.supportEnabled,
    support_goal: issue.supportGoal,
    created_at: dateFromApi(issue.createdAt),
    closed_at: dateFromApi(issue.closedAt),
    support_deadline_at: dateFromApi(issue.supportDeadlineAt),
    response_deadline_at: dateFromApi(issue.responseDeadlineAt),
    review_approved_at: dateFromApi(issue.reviewApprovedAt),
    result_content: issue.resultContent ?? undefined,
    support_met_at: dateFromApi(issue.supportMetAt),
    review_rejection_reason: issue.reviewRejectionReason,
    currentUserSupported: issue.currentUserSupported,
    isOwnIssue: issue.isOwnIssue,
    canManageIssue: issue.canManageIssue,
    canViewAuthor: issue.canViewAuthor,
    author_uid: issue.authorUid,
  });
  return record;
}

function normalizeDiscussionCommentResponse(comment: CommentResponseRecord): DiscussionCommentRecord {
  return {
    id: comment.id,
    parent_comment_id: comment.parentCommentId,
    content: comment.content,
    author_uid: comment.authorUid,
    created_at: dateFromApi(comment.createdAt),
    replies: (comment.replies ?? []).map(normalizeDiscussionCommentResponse),
  };
}

function normalizeCommentResponse(comment: CommentResponseRecord): CommentRecord {
  return {
    ...normalizeDiscussionCommentResponse(comment),
    issue_id: comment.issueId,
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
      { title: string; content: string; category: string },
      { issue: IssueResponseRecord }
    >('createIssue');
    const result = await fn({
      title: input.title,
      content: input.content,
      category: input.category,
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
      { issueId: string; status: IssueStatus; reason?: string },
      { issue: IssueResponseRecord }
    >('moderateIssueStatus');
    const result = await fn({ issueId, status, reason });
    invalidateIssueCache(issueId);
    return normalizeIssueResponse(result.issue);
  } catch (error) {
    throw toReadableBackendError(error);
  }
}

export async function updateIssueResult(issueId: string, resultContent: string) {
  try {
    const fn = invokeBackendAction<
      { issueId: string; resultContent: string },
      { issue: IssueResponseRecord }
    >('updateIssueResult');
    const result = await fn({ issueId, resultContent });
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
    const fn = invokeBackendAction<{ issueId: string }, SupportResponse>('toggleSupport');
    const result = await fn({ issueId });
    invalidateIssueCache(issueId);
    return { ...result, support_count: result.supportCount };
  } catch (error) {
    throw toReadableBackendError(error);
  }
}

export async function removeSupport(issueId: string) {
  try {
    const fn = invokeBackendAction<{ issueId: string }, SupportResponse>('removeSupport');
    const result = await fn({ issueId });
    invalidateIssueCache(issueId);
    return { ...result, support_count: result.supportCount };
  } catch (error) {
    throw toReadableBackendError(error);
  }
}

export async function deleteIssue(
  issueId: string,
) {
  try {
    const fn = invokeBackendAction<{ issueId: string }, { success: boolean; issueId: string }>('deleteIssue');
    const result = await fn({ issueId });
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
      { issueId: string; content: string; parentCommentId?: string | null },
      { comment: CommentResponseRecord }
    >('createComment');
    const result = await fn({
      issueId,
      content: input.content,
      parentCommentId,
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
    await fn({ commentId });
    markContentCachePrefixStale('issue-comments-page|');
  } catch (error) {
    throw toReadableBackendError(error);
  }
}
