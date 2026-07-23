import type { CommentRecord } from '@/types';
import { invokeBackendAction } from './backend-action';
import type { CommentCursor } from './comment-cursor';
import { normalizeCommentCursor } from './comment-cursor';
import { toReadableBackendError } from './issues-core';
import type { CommentResponseRecord } from './issues-read-shared';
import { READ_REQUEST_TIMEOUT_MS } from '@/lib/request';
import { getRouteRequestSignal } from '@/lib/route-request';
import { captureContentCacheWriteGuard, createContentCacheKey, getCachedContentPersistent, setCachedContentFromRead } from '@/services/content-read-cache';
import { COMMENT_FEED_PAGE_SIZE } from '@/lib/page-size';
import { prepareContentRevisionRead } from '@/services/content-revisions';

interface FetchCommentsOptions {
  cacheScope?: string;
  forceRefresh?: boolean;
  signal?: AbortSignal | null;
}

function getCommentRequestSignal(options?: FetchCommentsOptions) {
  if (options && 'signal' in options) return options.signal ?? undefined;
  return getRouteRequestSignal();
}

export async function fetchComments(
  issueId: string,
  cursor?: CommentCursor | null,
  options?: FetchCommentsOptions,
) {
  if (!options?.forceRefresh) await prepareContentRevisionRead();
  const cacheKey = createContentCacheKey([
    'issue-comments-page',
    issueId,
    options?.cacheScope ?? 'default',
    cursor?.id ?? 'first',
    cursor?.createdAtMs ?? '',
  ]);
  if (!options?.forceRefresh) {
    const cached = await getCachedContentPersistent<{ comments: CommentRecord[]; cursor: CommentCursor | null; hasMore: boolean }>(cacheKey);
    if (cached) return cached;
  }
  const cacheGuard = captureContentCacheWriteGuard(cacheKey);

  try {
    const fn = invokeBackendAction<
      { issueId: string; cursor?: CommentCursor | null; pageSize: number },
      { comments: CommentResponseRecord[]; cursor: CommentCursor | null; hasMore: boolean }
    >('listComments', {
      signal: getCommentRequestSignal(options),
      timeoutMs: READ_REQUEST_TIMEOUT_MS,
    });
    const result = await fn({ issueId, cursor, pageSize: COMMENT_FEED_PAGE_SIZE });

    const page = {
      comments: result.comments.map((comment) => ({
        id: comment.id,
        issue_id: comment.issue_id,
        parent_comment_id: comment.parent_comment_id,
        content: comment.content,
        author_uid: comment.author_uid,
        created_at: comment.created_at_ms === null ? null : new Date(comment.created_at_ms),
        replies: (comment.replies ?? []).map((reply) => ({
          id: reply.id,
          issue_id: comment.issue_id,
          parent_comment_id: reply.parent_comment_id,
          content: reply.content,
          author_uid: reply.author_uid,
          created_at: reply.created_at_ms === null ? null : new Date(reply.created_at_ms),
          replies: [],
        })),
      })),
      cursor: normalizeCommentCursor(result.cursor),
      hasMore: result.hasMore,
    } satisfies { comments: CommentRecord[]; cursor: CommentCursor | null; hasMore: boolean };
    setCachedContentFromRead(cacheGuard, page);
    return page;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}
