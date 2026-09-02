import type {
  AnnouncementCommentRecord,
  AnnouncementInput,
  AnnouncementRecord,
  AnnouncementSummary,
  CommentSortOption,
} from '@/types';
import { invokeBackendAction } from '@/services/backend-action';
import { READ_REQUEST_TIMEOUT_MS, RequestFailure } from '@/lib/request';
import {
  captureContentCacheWriteGuard,
  createContentCacheKey,
  getCachedContent,
  getCachedContentPersistent,
  markContentCachePrefixStale,
  setCachedContentFromRead,
} from '@/services/content-read-cache';
import { normalizeDate, toReadableBackendError } from '@/services/issues-core';
import type { CommentCursor } from './comment-cursor';
import { normalizeCommentCursor } from './comment-cursor';
import { COMMENT_FEED_PAGE_SIZE } from '@/lib/page-size';
import { registerContentVersion } from '@/services/content-versions';

const ANNOUNCEMENT_LIMIT = 10;
const ANNOUNCEMENT_LIST_CACHE_PREFIX = 'announcement-list-page|';
export type AnnouncementCursor = { id: string; publishedAt: string } | null;

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
  const publishedAtMs = numberFromDateLike(record.publishedAt);
  if (!id || publishedAtMs === null) return null;
  return {
    id,
    publishedAt: new Date(publishedAtMs).toISOString(),
  };
}

function normalizeAnnouncementSummary(data: Record<string, unknown>): AnnouncementSummary {
  return {
    id: String(data.id ?? ''),
    title: String(data.title ?? ''),
    author_uid: String(data.authorUid ?? ''),
    published_at: dateFromMs(data.publishedAt),
    like_count: Number(data.likeCount ?? 0),
    comment_count: Number(data.commentCount ?? 0),
    comments_enabled: data.commentsEnabled !== false,
    currentUserLiked: Boolean(data.currentUserLiked),
    deleting: data.deleting === true,
  };
}

function normalizeAnnouncementRecord(data: Record<string, unknown>): AnnouncementRecord {
  return {
    ...normalizeAnnouncementSummary(data),
    content: String(data.content ?? ''),
  };
}

function normalizeAnnouncementComment(data: Record<string, unknown>): AnnouncementCommentRecord {
  return {
    id: String(data.id ?? ''),
    announcement_id: String(data.announcementId ?? ''),
    parent_comment_id: typeof data.parentCommentId === 'string' ? data.parentCommentId : null,
    content: String(data.content ?? ''),
    author_uid: String(data.authorUid ?? ''),
    created_at: dateFromMs(data.createdAt),
    replies: Array.isArray(data.replies)
      ? data.replies.map((reply) => normalizeAnnouncementComment({
        ...(reply as Record<string, unknown>),
        announcementId: data.announcementId,
      }))
      : [],
  };
}

export async function fetchAnnouncementsPage(
  cursor: AnnouncementCursor = null,
  pageSize = ANNOUNCEMENT_LIMIT,
  options: { cacheScope?: string; forceRefresh?: boolean; signal?: AbortSignal } = {},
) {
  const cacheKey = createContentCacheKey([
    'announcement-list-page',
    'summary-v2',
    options.cacheScope ?? 'default',
    pageSize,
    cursor?.id ?? 'first',
    cursor?.publishedAt ?? '',
  ]);
  if (!options.forceRefresh) {
    const cached = await getCachedContentPersistent<{ announcements: AnnouncementSummary[]; cursor: AnnouncementCursor; hasMore: boolean; version: number }>(cacheKey);
    if (cached) {
      registerContentVersion('announcements', cached.version);
      return cached;
    }
  }
  const cacheGuard = captureContentCacheWriteGuard(cacheKey);

  try {
    const fn = invokeBackendAction<
      { cursor: AnnouncementCursor; pageSize: number },
      { announcements: Record<string, unknown>[]; cursor: AnnouncementCursor; hasMore: boolean; version: number }
    >('listAnnouncements', { signal: options.signal, timeoutMs: READ_REQUEST_TIMEOUT_MS });
    const result = await fn({ cursor, pageSize });
    const page = {
      announcements: result.announcements.map(normalizeAnnouncementSummary),
      cursor: normalizeAnnouncementCursor(result.cursor),
      hasMore: result.hasMore,
      version: result.version,
    };
    setCachedContentFromRead(cacheGuard, page);
    registerContentVersion('announcements', result.version);
    return page;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}

export async function fetchAnnouncementRecordById(
  announcementId: string,
  options: { cacheScope?: string; forceRefresh?: boolean } = {},
): Promise<AnnouncementRecord> {
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

export function peekAnnouncementRecordById(
  announcementId: string,
  cacheScope: string | undefined,
) {
  return getCachedContent<AnnouncementRecord>(
    createContentCacheKey(['announcement-detail', announcementId, cacheScope ?? 'default']),
  );
}

export async function createAnnouncement(input: AnnouncementInput): Promise<AnnouncementRecord> {
  const fn = invokeBackendAction<AnnouncementInput, { announcement: Record<string, unknown> }>('createAnnouncement');
  const result = await fn(input);
  const announcement = normalizeAnnouncementRecord(result.announcement);
  markContentCachePrefixStale(ANNOUNCEMENT_LIST_CACHE_PREFIX);
  return announcement;
}

export async function deleteAnnouncement(announcementId: string) {
  const fn = invokeBackendAction<{ announcementId: string }, { success: boolean }>('deleteAnnouncement');
  const result = await fn({ announcementId });
  markContentCachePrefixStale(ANNOUNCEMENT_LIST_CACHE_PREFIX);
  markContentCachePrefixStale(`announcement-detail|${announcementId}|`);
  return result;
}

export async function setAnnouncementLike(announcementId: string, liked: boolean) {
  const fn = invokeBackendAction<
    { announcementId: string; liked: boolean },
    { liked: boolean; likeCount: number }
  >('setAnnouncementLike');
  const result = await fn({ announcementId, liked });
  markContentCachePrefixStale(ANNOUNCEMENT_LIST_CACHE_PREFIX);
  markContentCachePrefixStale(`announcement-detail|${announcementId}|`);
  return { ...result, like_count: result.likeCount };
}

export async function fetchAnnouncementComments(
  announcementId: string,
  cursor?: CommentCursor,
  sort: CommentSortOption = 'newest',
  options: { cacheScope?: string; forceRefresh?: boolean; signal?: AbortSignal | null } = {},
) {
  const cacheKey = createContentCacheKey([
    'announcement-comments-page',
    announcementId,
    options.cacheScope ?? 'default',
    sort,
    cursor?.id ?? 'first',
    cursor?.createdAt ?? '',
  ]);
  if (!options.forceRefresh) {
    const cached = await getCachedContentPersistent<{ comments: AnnouncementCommentRecord[]; cursor: CommentCursor; hasMore: boolean; version: number }>(cacheKey);
    if (cached) {
      registerContentVersion('announcements', cached.version);
      return cached;
    }
  }
  const cacheGuard = captureContentCacheWriteGuard(cacheKey);

  const fn = invokeBackendAction<
    { announcementId: string; cursor?: CommentCursor; pageSize: number; sort: CommentSortOption },
    { comments: Array<Record<string, unknown>>; cursor: CommentCursor; hasMore: boolean; version: number }
  >('listAnnouncementComments', {
    signal: 'signal' in options ? options.signal ?? undefined : undefined,
    timeoutMs: READ_REQUEST_TIMEOUT_MS,
  });
  const result = await fn({ announcementId, cursor, pageSize: COMMENT_FEED_PAGE_SIZE, sort });
  const page = {
    comments: result.comments.map(normalizeAnnouncementComment),
    cursor: normalizeCommentCursor(result.cursor),
    hasMore: result.hasMore,
    version: result.version,
  } satisfies {
    comments: AnnouncementCommentRecord[];
    cursor: CommentCursor;
    hasMore: boolean;
    version: number;
  };
  setCachedContentFromRead(cacheGuard, page);
  registerContentVersion('announcements', result.version);
  return page;
}

export async function createAnnouncementComment(announcementId: string, content: string, parentCommentId: string | null = null) {
  const fn = invokeBackendAction<
    { announcementId: string; content: string; parentCommentId?: string | null },
    { comment: Record<string, unknown>; commentCount: number }
  >('createAnnouncementComment');
  const result = await fn({ announcementId, content, parentCommentId });
  markContentCachePrefixStale(`announcement-comments-page|${announcementId}|`);
  markContentCachePrefixStale(ANNOUNCEMENT_LIST_CACHE_PREFIX);
  markContentCachePrefixStale(`announcement-detail|${announcementId}|`);
  return {
    comment: normalizeAnnouncementComment(result.comment),
    comment_count: result.commentCount,
  };
}

export async function deleteAnnouncementComment(commentId: string) {
  const fn = invokeBackendAction<
    { commentId: string },
    { success: boolean; announcementId: string; commentCount: number }
  >('deleteAnnouncementComment');
  const result = await fn({ commentId });
  markContentCachePrefixStale(`announcement-comments-page|${result.announcementId}|`);
  markContentCachePrefixStale(ANNOUNCEMENT_LIST_CACHE_PREFIX);
  markContentCachePrefixStale(`announcement-detail|${result.announcementId}|`);
  return { ...result, announcement_id: result.announcementId, comment_count: result.commentCount };
}
