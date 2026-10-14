import type { AnnouncementCursor } from '@shared/contracts/announcements.ts';
import type { CommentCursor, CommentSort } from '@shared/contracts/discussions.ts';
import { callAction } from '@/services/backend-action';
import { toReadableBackendError } from '@/services/backend-errors';
import { readRequestTimeoutMs, RequestFailure } from '@/lib/request';
import { invalidate, invalidateLists, seedQuery } from '@/lib/query-client';
import { registerContentVersion } from '@/services/content-versions';
import type { AnnouncementRecord } from '@/types';

export const announcementKeys = {
  list: () => ['announcements', 'list'] as const,
  unread: () => ['announcements', 'unread'] as const,
  detail: (announcementId: string) => ['announcements', 'detail', announcementId] as const,
  comments: (announcementId: string, sort: CommentSort) => ['announcements', 'comments', announcementId, sort] as const,
};

export async function listAnnouncements(cursor: AnnouncementCursor | null, signal?: AbortSignal) {
  try {
    const page = await callAction('listAnnouncements', { cursor }, { signal, timeoutMs: readRequestTimeoutMs });
    registerContentVersion('announcements', page.version);
    return page;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}

export async function getAnnouncement(announcementId: string, signal?: AbortSignal): Promise<AnnouncementRecord> {
  try {
    return (await callAction('getAnnouncement', { announcementId }, { signal, timeoutMs: readRequestTimeoutMs })).announcement;
  } catch (error) {
    if (error instanceof RequestFailure) throw error;
    throw new Error('announcement.thisAnnouncementCannotBeFound', { cause: error });
  }
}

/** What one change to an announcement makes stale: the list, and the announcement itself. */
function invalidateAnnouncement(announcementId?: string) {
  void invalidateLists('announcements');
  if (announcementId) void invalidate(announcementKeys.detail(announcementId));
}

export async function createAnnouncement(input: { title: string; content: string }) {
  const { announcement } = await callAction('createAnnouncement', input);
  seedQuery(announcementKeys.detail(announcement.id), announcement);
  invalidateAnnouncement();
  return announcement;
}

export async function deleteAnnouncement(announcementId: string) {
  await callAction('deleteAnnouncement', { announcementId });
  void invalidateLists('announcements');
}

export async function setAnnouncementLike(announcementId: string, liked: boolean) {
  const result = await callAction('setAnnouncementLike', { announcementId, liked });
  invalidateAnnouncement(announcementId);
  return result;
}

export async function listAnnouncementComments(
  announcementId: string,
  cursor: CommentCursor | null,
  sort: CommentSort,
  signal?: AbortSignal,
) {
  const page = await callAction('listAnnouncementComments', { announcementId, cursor, sort }, { signal, timeoutMs: readRequestTimeoutMs });
  registerContentVersion('announcements', page.version);
  return page;
}

export async function createAnnouncementComment(announcementId: string, content: string, parentCommentId: string | null) {
  const result = await callAction('createAnnouncementComment', { announcementId, content, parentCommentId });
  await invalidate(['announcements', 'comments', announcementId]);
  return result;
}

export async function deleteAnnouncementComment(commentId: string) {
  const result = await callAction('deleteAnnouncementComment', { commentId });
  await invalidate(['announcements', 'comments', result.announcementId]);
  return result;
}
