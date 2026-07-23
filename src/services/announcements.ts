import type {
  AnnouncementCommentRecord,
  AnnouncementInput,
  AnnouncementRecord,
} from '@/types';
import { invokeBackendAction } from '@/services/backend-action';
import { createRequestId } from '@/lib/request-id';
import { READ_REQUEST_TIMEOUT_MS, RequestFailure } from '@/lib/request';
import {
  captureContentCacheWriteGuard,
  createContentCacheKey,
  getCachedContentPersistent,
  markContentCachePrefixStale,
  setCachedContentFromRead,
} from '@/services/content-read-cache';
import { normalizeDate, toReadableBackendError } from '@/services/issues-core';
import type { CommentCursor } from './comment-cursor';
import { normalizeCommentCursor } from './comment-cursor';
import { COMMENT_FEED_PAGE_SIZE } from '@/lib/page-size';
import { prepareContentRevisionRead } from '@/services/content-revisions';

const ANNOUNCEMENT_LIMIT = 10;
const ANNOUNCEMENT_LIST_CACHE_PREFIX = 'announcement-list-page|';
export type AnnouncementCursor = { id: string; publishedAtMs: number } | null;

function dateFromMs(value: unknown) {
  return typeof value === 'number' ? new Date(value) : normalizeDate(value);
}

function numberFromDateLike(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const date = normalizeDate(value);
  return date ? date.getTime() : null;
}

function normalizeAnnouncementCursor(data: unknown): AnnouncementCursor {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id : '';
  const publishedAtMs = numberFromDateLike(record.publishedAtMs ?? record.published_at);
  if (!id || publishedAtMs === null) return null;
  return {
    id,
    publishedAtMs,
  };
}

function normalizeAnnouncementRecord(data: Record<string, unknown>): AnnouncementRecord {
  return {
    id: String(data.id ?? ''),
    title: String(data.title ?? ''),
    content: String(data.content ?? ''),
    author_uid: String(data.author_uid ?? ''),
    published_at: dateFromMs(data.published_at_ms ?? data.published_at),
    like_count: Number(data.like_count ?? 0),
    comment_count: Number(data.comment_count ?? 0),
    currentUserLiked: Boolean(data.currentUserLiked),
    deleting: data.deleting === true,
  };
}

function normalizeAnnouncementComment(data: Record<string, unknown>): AnnouncementCommentRecord {
  return {
    id: String(data.id ?? ''),
    announcement_id: String(data.announcement_id ?? ''),
    parent_comment_id: typeof data.parent_comment_id === 'string' ? data.parent_comment_id : null,
    content: String(data.content ?? ''),
    author_uid: String(data.author_uid ?? ''),
    created_at: dateFromMs(data.created_at_ms ?? data.created_at),
    replies: Array.isArray(data.replies)
      ? data.replies.map((reply) => normalizeAnnouncementComment({
        ...(reply as Record<string, unknown>),
        announcement_id: data.announcement_id,
      }))
      : [],
  };
}

export async function fetchAnnouncementsPage(
  cursor: AnnouncementCursor = null,
  pageSize = ANNOUNCEMENT_LIMIT,
  options: { cacheScope?: string; forceRefresh?: boolean; signal?: AbortSignal } = {},
) {
  if (!options.forceRefresh) await prepareContentRevisionRead();
  const cacheKey = createContentCacheKey([
    'announcement-list-page',
    options.cacheScope ?? 'default',
    pageSize,
    cursor?.id ?? 'first',
    cursor?.publishedAtMs ?? '',
  ]);
  if (!options.forceRefresh) {
    const cached = await getCachedContentPersistent<{ announcements: AnnouncementRecord[]; cursor: AnnouncementCursor; hasMore: boolean }>(cacheKey);
    if (cached) return cached;
  }
  const cacheGuard = captureContentCacheWriteGuard(cacheKey);

  try {
    const fn = invokeBackendAction<
      { cursor: AnnouncementCursor; pageSize: number },
      { announcements: Record<string, unknown>[]; cursor: AnnouncementCursor; hasMore: boolean }
    >('listAnnouncements', { signal: options.signal, timeoutMs: READ_REQUEST_TIMEOUT_MS });
    const result = await fn({ cursor, pageSize });
    const page = {
      announcements: result.announcements.map(normalizeAnnouncementRecord),
      cursor: normalizeAnnouncementCursor(result.cursor),
      hasMore: result.hasMore,
    };
    setCachedContentFromRead(cacheGuard, page);
    return page;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}

export async function fetchAnnouncementRecordById(
  announcementId: string,
  options: { cacheScope?: string; forceRefresh?: boolean } = {},
): Promise<AnnouncementRecord> {
  if (!options.forceRefresh) await prepareContentRevisionRead();
  const cacheKey = createContentCacheKey(['announcement-detail', announcementId, options.cacheScope ?? 'default']);
  if (!options.forceRefresh) {
    const cached = await getCachedContentPersistent<AnnouncementRecord>(cacheKey);
    if (cached) return cached;
  }
  const cacheGuard = captureContentCacheWriteGuard(cacheKey);

  try {
    const fn = invokeBackendAction<
      { announcementId: string },
      { announcement: Record<string, unknown> }
    >('getAnnouncement', { timeoutMs: READ_REQUEST_TIMEOUT_MS });
    const result = await fn({ announcementId });
    const announcement = normalizeAnnouncementRecord(result.announcement);
    setCachedContentFromRead(cacheGuard, announcement);
    return announcement;
  } catch (error) {
    if (error instanceof RequestFailure) throw error;
    throw new Error('announcement.thisAnnouncementCannotBeFound', { cause: error });
  }
}

export async function createAnnouncement(input: AnnouncementInput): Promise<AnnouncementRecord> {
  const fn = invokeBackendAction<AnnouncementInput & { requestId: string }, { announcement: Record<string, unknown> }>('createAnnouncement');
  const result = await fn({ ...input, requestId: createRequestId() });
  const announcement = normalizeAnnouncementRecord(result.announcement);
  markContentCachePrefixStale(ANNOUNCEMENT_LIST_CACHE_PREFIX);
  return announcement;
}

export async function deleteAnnouncement(announcementId: string) {
  const fn = invokeBackendAction<{ announcementId: string; requestId: string }, { success: boolean }>('deleteAnnouncement');
  const result = await fn({ announcementId, requestId: createRequestId() });
  markContentCachePrefixStale(ANNOUNCEMENT_LIST_CACHE_PREFIX);
  markContentCachePrefixStale(`announcement-detail|${announcementId}|`);
  return result;
}

export async function setAnnouncementLike(announcementId: string, liked: boolean) {
  const fn = invokeBackendAction<
    { announcementId: string; liked: boolean; requestId: string },
    { liked: boolean; like_count: number }
  >('setAnnouncementLike');
  const result = await fn({ announcementId, liked, requestId: createRequestId() });
  markContentCachePrefixStale(ANNOUNCEMENT_LIST_CACHE_PREFIX);
  markContentCachePrefixStale(`announcement-detail|${announcementId}|`);
  return result;
}

export async function fetchAnnouncementComments(
  announcementId: string,
  cursor?: CommentCursor,
  options: { cacheScope?: string; forceRefresh?: boolean; signal?: AbortSignal | null } = {},
) {
  if (!options.forceRefresh) await prepareContentRevisionRead();
  const cacheKey = createContentCacheKey([
    'announcement-comments-page',
    announcementId,
    options.cacheScope ?? 'default',
    cursor?.id ?? 'first',
    cursor?.createdAtMs ?? '',
  ]);
  if (!options.forceRefresh) {
    const cached = await getCachedContentPersistent<{ comments: AnnouncementCommentRecord[]; cursor: CommentCursor; hasMore: boolean }>(cacheKey);
    if (cached) return cached;
  }
  const cacheGuard = captureContentCacheWriteGuard(cacheKey);

  const fn = invokeBackendAction<
    { announcementId: string; cursor?: CommentCursor; pageSize: number },
    { comments: Array<Record<string, unknown>>; cursor: CommentCursor; hasMore: boolean }
  >('listAnnouncementComments', {
    signal: 'signal' in options ? options.signal ?? undefined : undefined,
    timeoutMs: READ_REQUEST_TIMEOUT_MS,
  });
  const result = await fn({ announcementId, cursor, pageSize: COMMENT_FEED_PAGE_SIZE });
  const page = {
    comments: result.comments.map(normalizeAnnouncementComment),
    cursor: normalizeCommentCursor(result.cursor),
    hasMore: result.hasMore,
  } satisfies {
    comments: AnnouncementCommentRecord[];
    cursor: CommentCursor;
    hasMore: boolean;
  };
  setCachedContentFromRead(cacheGuard, page);
  return page;
}

export async function createAnnouncementComment(announcementId: string, content: string, parentCommentId: string | null = null) {
  const fn = invokeBackendAction<
    { announcementId: string; content: string; parentCommentId?: string | null; requestId: string },
    { comment: Record<string, unknown>; comment_count: number }
  >('createAnnouncementComment');
  const result = await fn({ announcementId, content, parentCommentId, requestId: createRequestId() });
  markContentCachePrefixStale(`announcement-comments-page|${announcementId}|`);
  markContentCachePrefixStale(ANNOUNCEMENT_LIST_CACHE_PREFIX);
  markContentCachePrefixStale(`announcement-detail|${announcementId}|`);
  return {
    comment: normalizeAnnouncementComment(result.comment),
    comment_count: result.comment_count,
  };
}

export async function deleteAnnouncementComment(commentId: string) {
  const fn = invokeBackendAction<
    { commentId: string; requestId: string },
    { success: boolean; announcement_id: string; comment_count: number }
  >('deleteAnnouncementComment');
  const result = await fn({ commentId, requestId: createRequestId() });
  markContentCachePrefixStale(`announcement-comments-page|${result.announcement_id}|`);
  markContentCachePrefixStale(ANNOUNCEMENT_LIST_CACHE_PREFIX);
  markContentCachePrefixStale(`announcement-detail|${result.announcement_id}|`);
  return result;
}
