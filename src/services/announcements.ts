import type { ActionOutput } from '@shared/actions.ts';
import type { AnnouncementCursor } from '@shared/contracts/announcements.ts';
import type { CommentCursor, CommentSort } from '@shared/contracts/discussions.ts';
import { callAction } from '@/services/backend-action';
import { toReadableBackendError } from '@/services/backend-errors';
import { readRequestTimeoutMs, RequestFailure } from '@/lib/request';
import {
  captureContentCacheWriteGuard,
  createContentCacheKey,
  getCachedContent,
  getCachedContentPersistent,
  markContentCachePrefixStale,
  setCachedContentFromRead,
} from '@/services/content-read-cache';
import { registerContentVersion } from '@/services/content-versions';
import type { AnnouncementRecord } from '@/types';

const ANNOUNCEMENT_LIST_CACHE_PREFIX = 'announcement-list-page|';
export type AnnouncementPage = ActionOutput<'listAnnouncements'>;

export async function listAnnouncements(
  cursor: AnnouncementCursor | null = null,
  options: { cacheScope?: string; forceRefresh?: boolean; signal?: AbortSignal } = {},
) {
  const cacheKey = createContentCacheKey([
    'announcement-list-page', options.cacheScope ?? 'default', cursor?.id ?? 'first', cursor?.publishedAt ?? '',
  ]);
  if (!options.forceRefresh) {
    const cached = await getCachedContentPersistent<AnnouncementPage>(cacheKey);
    if (cached) {
      registerContentVersion('announcements', cached.version);
      return cached;
    }
  }
  const cacheGuard = captureContentCacheWriteGuard(cacheKey);
  try {
    const page = await callAction('listAnnouncements', { cursor }, { signal: options.signal, timeoutMs: readRequestTimeoutMs });
    setCachedContentFromRead(cacheGuard, page);
    registerContentVersion('announcements', page.version);
    return page;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}

function detailKey(announcementId: string, cacheScope: string | undefined) {
  return createContentCacheKey(['announcement-detail', announcementId, cacheScope ?? 'default']);
}

export async function getAnnouncement(
  announcementId: string,
  options: { cacheScope?: string; forceRefresh?: boolean } = {},
): Promise<AnnouncementRecord> {
  const cacheKey = detailKey(announcementId, options.cacheScope);
  if (!options.forceRefresh) {
    const cached = await getCachedContentPersistent<AnnouncementRecord>(cacheKey);
    if (cached) return cached;
  }
  const cacheGuard = captureContentCacheWriteGuard(cacheKey);
  try {
    const { announcement } = await callAction('getAnnouncement', { announcementId }, { timeoutMs: readRequestTimeoutMs });
    setCachedContentFromRead(cacheGuard, announcement);
    return announcement;
  } catch (error) {
    if (error instanceof RequestFailure) throw error;
    throw new Error('announcement.thisAnnouncementCannotBeFound', { cause: error });
  }
}

export function peekAnnouncement(announcementId: string, cacheScope: string | undefined) {
  return getCachedContent<AnnouncementRecord>(detailKey(announcementId, cacheScope));
}

function markAnnouncementStale(announcementId?: string) {
  markContentCachePrefixStale(ANNOUNCEMENT_LIST_CACHE_PREFIX);
  if (announcementId) markContentCachePrefixStale(`announcement-detail|${announcementId}|`);
}

export async function createAnnouncement(input: { title: string; content: string }) {
  const { announcement } = await callAction('createAnnouncement', input);
  markAnnouncementStale();
  return announcement;
}

export async function deleteAnnouncement(announcementId: string) {
  await callAction('deleteAnnouncement', { announcementId });
  markAnnouncementStale(announcementId);
}

export async function setAnnouncementLike(announcementId: string, liked: boolean) {
  const result = await callAction('setAnnouncementLike', { announcementId, liked });
  markAnnouncementStale(announcementId);
  return result;
}

export async function listAnnouncementComments(
  announcementId: string,
  cursor: CommentCursor | null,
  sort: CommentSort,
  options: { cacheScope?: string; forceRefresh?: boolean } = {},
) {
  const cacheKey = createContentCacheKey([
    'announcement-comments-page', announcementId, options.cacheScope ?? 'default', sort, cursor?.id ?? 'first', cursor?.createdAt ?? '',
  ]);
  if (!options.forceRefresh) {
    const cached = await getCachedContentPersistent<ActionOutput<'listAnnouncementComments'>>(cacheKey);
    if (cached) {
      registerContentVersion('announcements', cached.version);
      return cached;
    }
  }
  const cacheGuard = captureContentCacheWriteGuard(cacheKey);
  const page = await callAction('listAnnouncementComments', { announcementId, cursor, sort }, { timeoutMs: readRequestTimeoutMs });
  setCachedContentFromRead(cacheGuard, page);
  registerContentVersion('announcements', page.version);
  return page;
}

export async function createAnnouncementComment(announcementId: string, content: string, parentCommentId: string | null) {
  const result = await callAction('createAnnouncementComment', { announcementId, content, parentCommentId });
  markContentCachePrefixStale(`announcement-comments-page|${announcementId}|`);
  markAnnouncementStale(announcementId);
  return result;
}

export async function deleteAnnouncementComment(commentId: string) {
  const result = await callAction('deleteAnnouncementComment', { commentId });
  markContentCachePrefixStale(`announcement-comments-page|${result.announcementId}|`);
  markAnnouncementStale(result.announcementId);
  return result;
}
