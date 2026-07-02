import { RequestFailure } from '@/lib/request';

export function toReadableBackendError(error: unknown) {
  if (error instanceof RequestFailure) return error;
  const message = error instanceof Error ? error.message : '';
  if (message.includes('達到上限')) {
    return new Error(message);
  }
  if (isContentUnavailableError(error)) {
    return new Error(message || '內容已不存在。');
  }
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (code === 'permission-denied' || code === '42501') {
    return new Error('目前沒有權限進行此操作。');
  }
  if (code === 'unauthenticated' || code === '401') {
    return new Error('請先登入後再繼續。');
  }
  if (/backend|後端|provider|session|permission-denied|unauthenticated/i.test(message)) {
    return new Error('操作失敗，請稍後再試。');
  }
  return new Error(message || '操作失敗，請稍後再試。');
}

export function isContentUnavailableError(error: unknown) {
  if (error && typeof error === 'object') {
    const code = 'code' in error ? String(error.code) : '';
    const details = 'details' in error ? (error.details as Record<string, unknown> | null) : null;
    if (details && (details.reason === 'CONTENT_DELETED' || details.reason === 'CONTENT_NOT_FOUND')) {
      return true;
    }
    if (code === 'not-found' || code === 'PGRST116') {
      return true;
    }
  }
  const message = error instanceof Error ? error.message : String(error ?? '');
  return message.includes('已刪除') || message.includes('找不到');
}
