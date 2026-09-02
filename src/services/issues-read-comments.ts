import type { CommentRecord, CommentSortOption } from '@/types';
import { invokeBackendAction } from './backend-action';
import type { CommentCursor } from './comment-cursor';
import { normalizeCommentCursor } from './comment-cursor';
import { toReadableBackendError } from './issues-core';
import type { CommentResponseRecord } from './issues-read-shared';
import { READ_REQUEST_TIMEOUT_MS } from '@/lib/request';
import { getRouteRequestSignal } from '@/lib/route-request';
import { captureContentCacheWriteGuard, createContentCacheKey, getCachedContentPersistent, setCachedContentFromRead } from '@/services/content-read-cache';
import { COMMENT_FEED_PAGE_SIZE } from '@/lib/page-size';
import { registerContentVersion } from '@/services/content-versions';

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
  sort: CommentSortOption = 'newest',
  options?: FetchCommentsOptions,
) {
  const cacheKey = createContentCacheKey([
    'issue-comments-page',
    issueId,
    options?.cacheScope ?? 'default',
    sort,
    cursor?.id ?? 'first',
    cursor?.createdAt ?? '',
  ]);
  if (!options?.forceRefresh) {
    const cached = await getCachedContentPersistent<{ comments: CommentRecord[]; cursor: CommentCursor | null; hasMore: boolean; version: number }>(cacheKey);
    if (cached) {
      registerContentVersion('issues', cached.version);
      return cached;
    }
  }
  const cacheGuard = captureContentCacheWriteGuard(cacheKey);

  try {
    const fn = invokeBackendAction<
      { issueId: string; cursor?: CommentCursor | null; pageSize: number; sort: CommentSortOption },
      { comments: CommentResponseRecord[]; cursor: CommentCursor | null; hasMore: boolean; version: number }
    >('listComments', {
      signal: getCommentRequestSignal(options),
      timeoutMs: READ_REQUEST_TIMEOUT_MS,
    });
    const result = await fn({ issueId, cursor, pageSize: COMMENT_FEED_PAGE_SIZE, sort });

    const page = {
      comments: result.comments.map((comment) => ({
        id: comment.id,
        issue_id: comment.issueId,
        parent_comment_id: comment.parentCommentId,
        content: comment.content,
        author_uid: comment.authorUid,
        created_at: comment.createdAt === null ? null : new Date(comment.createdAt),
        replies: (comment.replies ?? []).map((reply) => ({
          id: reply.id,
          issue_id: comment.issueId,
          parent_comment_id: reply.parentCommentId,
          content: reply.content,
          author_uid: reply.authorUid,
          created_at: reply.createdAt === null ? null : new Date(reply.createdAt),
          replies: [],
        })),
      })),
      cursor: normalizeCommentCursor(result.cursor),
      hasMore: result.hasMore,
      version: result.version,
    } satisfies { comments: CommentRecord[]; cursor: CommentCursor | null; hasMore: boolean; version: number };
    setCachedContentFromRead(cacheGuard, page);
    registerContentVersion('issues', result.version);
    return page;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}
