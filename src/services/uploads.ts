import { invokeBackendAction } from '@/services/backend-action';
import { createRequestId } from '@/lib/request-id';
import { LONG_REQUEST_TIMEOUT_MS, READ_REQUEST_TIMEOUT_MS, withRequestTimeout } from '@/lib/request';
import { toReadableBackendError } from './issues-core';

interface ResolvedUploadCacheEntry {
  expiresAtMs: number;
  url: string;
}

const resolvedUploadCache = new Map<string, ResolvedUploadCacheEntry>();
const resolvedUploadRefreshBufferMs = 60 * 1000;

export function clearResolvedUploadCache() {
  resolvedUploadCache.clear();
}

interface ImageUploadPolicy {
  height: number;
  uploadId: string;
  storagePath: string;
  width: number;
}

interface ImageUploadSession {
  apiKey: string;
  cloudName: string;
  folder?: string;
  publicId: string;
  signature: string;
  timestamp: number;
  uploadId: string;
}

function toReadableUploadError(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  const uploadMessage = message.replace(/^FirebaseError:\s*/u, '').trim();

  if (uploadMessage && /圖片|WebP|JPEG|UPLOAD-/u.test(uploadMessage)) {
    return new Error(uploadMessage);
  }

  return toReadableBackendError(error);
}

export async function createImageUploadPolicy(file: File, width: number, height: number): Promise<ImageUploadPolicy> {
  if (file.type !== 'image/webp') {
    throw new Error('圖片必須轉換為 WebP 後才能上傳。');
  }

  try {
    const createSession = invokeBackendAction<
      { contentType: string; height: number; requestId: string; size: number; width: number },
      ImageUploadSession
    >('createImageUploadSession');
    const session = await createSession({
      contentType: file.type,
      height,
      requestId: createRequestId(),
      size: file.size,
      width,
    });
    const body = new FormData();
    body.set('file', file);
    body.set('api_key', session.data.apiKey);
    body.set('timestamp', String(session.data.timestamp));
    body.set('public_id', session.data.publicId);
    body.set('signature', session.data.signature);
    if (session.data.folder) {
      body.set('folder', session.data.folder);
    }

    await withRequestTimeout(async () => {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${session.data.cloudName}/image/upload`,
        { method: 'POST', body },
      );
      if (!response.ok) {
        throw new Error(`圖片上傳失敗：${response.status}`);
      }
    }, { label: '圖片上傳', timeoutMs: LONG_REQUEST_TIMEOUT_MS });

    const finalize = invokeBackendAction<{ uploadId: string }, ImageUploadPolicy>('finalizeImageUpload', {
      timeoutMs: LONG_REQUEST_TIMEOUT_MS,
    });
    return (await finalize({ uploadId: session.data.uploadId })).data;
  } catch (error) {
    throw toReadableUploadError(error);
  }
}

export async function deleteUploadedImage(storagePath: string) {
  try {
    const fn = invokeBackendAction<{ storagePath?: string; uploadId?: string }, { success: boolean }>('deleteUploadedImage');
    await fn({ storagePath });
  } catch (error) {
    throw toReadableBackendError(error);
  }
}

interface ResolveUploadOptions {
  forceRefresh?: boolean;
}

export function invalidateResolvedUploadCache(uploadIds: string[]) {
  uploadIds.forEach((uploadId) => resolvedUploadCache.delete(uploadId));
}

export async function resolveUploadImageUrls(uploadIds: string[], options: ResolveUploadOptions = {}) {
  const uniqueIds = [...new Set(uploadIds)];
  if (options.forceRefresh) {
    invalidateResolvedUploadCache(uniqueIds);
  }

  const now = Date.now();
  const cachedEntries = uniqueIds.flatMap((uploadId) => {
    const entry = resolvedUploadCache.get(uploadId);
    return entry && entry.expiresAtMs - resolvedUploadRefreshBufferMs > now
      ? [[uploadId, entry] as const]
      : [];
  });
  const cachedIds = new Set(cachedEntries.map(([uploadId]) => uploadId));
  const unresolvedIds = uniqueIds.filter((uploadId) => !cachedIds.has(uploadId));

  if (unresolvedIds.length === 0) {
    return {
      errors: {},
      expiresAtByUploadId: Object.fromEntries(cachedEntries.map(([id, entry]) => [id, entry.expiresAtMs])),
      expiresAtMs: Math.min(...cachedEntries.map(([, entry]) => entry.expiresAtMs)),
      urls: Object.fromEntries(cachedEntries.map(([id, entry]) => [id, entry.url])),
    };
  }

  try {
    const fn = invokeBackendAction<
      { uploadIds: string[] },
      {
        errors?: Record<string, string>;
        expiresAtByUploadId?: Record<string, number>;
        expiresAtMs: number;
        urls: Record<string, string>;
      }
    >('resolveUploadImageUrls', {
      timeoutMs: READ_REQUEST_TIMEOUT_MS,
    });
    const result = await fn({ uploadIds: unresolvedIds });
    const fetched = result.data;
    Object.entries(fetched.urls).forEach(([uploadId, url]) => {
      resolvedUploadCache.set(uploadId, {
        expiresAtMs: fetched.expiresAtByUploadId?.[uploadId] ?? fetched.expiresAtMs,
        url,
      });
    });

    const allEntries = uniqueIds.flatMap((uploadId) => {
      const cachedEntry = resolvedUploadCache.get(uploadId);
      const fetchedUrl = fetched.urls[uploadId];
      const entry = cachedEntry ?? (fetchedUrl ? {
        expiresAtMs: fetched.expiresAtByUploadId?.[uploadId] ?? fetched.expiresAtMs,
        url: fetchedUrl,
      } : undefined);
      return entry ? [[uploadId, entry] as const] : [];
    });
    const allExpirationValues = allEntries.map(([, entry]) => entry.expiresAtMs);
    return {
      errors: fetched.errors ?? {},
      expiresAtByUploadId: Object.fromEntries(allEntries.map(([id, entry]) => [id, entry.expiresAtMs])),
      expiresAtMs: allExpirationValues.length > 0
        ? Math.min(...allExpirationValues)
        : fetched.expiresAtMs,
      urls: Object.fromEntries(allEntries.map(([id, entry]) => [id, entry.url])),
    };
  } catch (error) {
    throw toReadableBackendError(error);
  }
}
