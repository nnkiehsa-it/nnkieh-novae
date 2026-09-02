import { normalizeDate } from '@/services/issues-core';

export type CommentCursor = { id: string; createdAt: string } | null;

export function normalizeCommentCursor(data: unknown): CommentCursor {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id : '';
  const createdAt = normalizeDate(record.createdAt);
  return id && createdAt ? { id, createdAt: createdAt.toISOString() } : null;
}
