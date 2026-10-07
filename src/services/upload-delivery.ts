import { invokeBackendAction } from '@/services/backend-action';
import { readRequestTimeoutMs } from '@/lib/request';
import { toReadableBackendError } from './issues-core';
import {
  captureContentCacheWriteGuard, CONTENT_SHORT_CACHE_TTL_MS, getCachedContent,
  getCachedContentPersistent, isContentCacheWriteGuardCurrent, markContentCachePrefixStale,
  runCoalescedContentRequest, setCachedContentFromRead, subscribeContentCacheInvalidations,
  type ContentCacheWriteGuard,
} from './content-read-cache';

interface ImageReference {
  expiresAtMs: number;
  fullUrl: string;
  thumbnailUrl: string;
}
interface DeliveryResult {
  errors: Record<string, string>;
  expiresAtByUploadId: Record<string, number>;
  expiresAtMs: number;
  fullUrls: Record<string, string>;
  thumbnailUrls: Record<string, string>;
}
interface BackendDeliveryResult {
  errors: Record<string, string>;
  expiresAtByUploadId: Record<string, string>;
  expiresAt: string;
  privateByUploadId: Record<string, boolean>;
  fullUrls: Record<string, string>;
  thumbnailUrls: Record<string, string>;
}

const prefix = 'upload-media|';
const refreshBufferMs = 60_000;
const privateReferences = new Map<string, { guard: ContentCacheWriteGuard; value: ImageReference }>();
let requestRevision = 0;
const cacheKey = (id: string) => `${prefix}${id}`;

export function clearResolvedUploadCache() {
  privateReferences.clear();
  requestRevision += 1;
  markContentCachePrefixStale(prefix);
}

// An attachment inherits visibility from its content, so changed content must
// invalidate persisted public references as well as private in-memory URLs.
subscribeContentCacheInvalidations((changed) => {
  if (/^(?:issue-|user-issue-|announcement-|facility-|category-)/u.test(changed)) clearResolvedUploadCache();
});

export function invalidateResolvedUploadCache(ids: string[]) {
  requestRevision += 1;
  for (const id of ids) {
    privateReferences.delete(id);
    markContentCachePrefixStale(cacheKey(id));
  }
}

export function getResolvedUploadReference(id: string): ImageReference | null {
  const transient = privateReferences.get(id);
  const value = transient && isContentCacheWriteGuardCurrent(transient.guard)
    ? transient.value : getCachedContent<ImageReference>(cacheKey(id), CONTENT_SHORT_CACHE_TTL_MS);
  return value && value.expiresAtMs > Date.now() + refreshBufferMs ? value : null;
}

function deliveryResult(entries: Array<readonly [string, ImageReference]>, errors: Record<string, string> = {}): DeliveryResult {
  return {
    errors,
    expiresAtByUploadId: Object.fromEntries(entries.map(([id, entry]) => [id, entry.expiresAtMs])),
    expiresAtMs: entries.length ? Math.min(...entries.map(([, entry]) => entry.expiresAtMs)) : Date.now(),
    fullUrls: Object.fromEntries(entries.map(([id, entry]) => [id, entry.fullUrl])),
    thumbnailUrls: Object.fromEntries(entries.map(([id, entry]) => [id, entry.thumbnailUrl])),
  };
}

export async function resolveUploadImageUrls(ids: string[], options: { forceRefresh?: boolean } = {}): Promise<DeliveryResult> {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (options.forceRefresh) invalidateResolvedUploadCache(uniqueIds);
  const guard = captureContentCacheWriteGuard(prefix);
  const revision = requestRevision;
  const current = () => revision === requestRevision && isContentCacheWriteGuardCurrent(guard);
  const restored = await Promise.all(uniqueIds.map(async (id) => {
    const value = getResolvedUploadReference(id)
      ?? await getCachedContentPersistent<ImageReference>(cacheKey(id), CONTENT_SHORT_CACHE_TTL_MS);
    return value && value.expiresAtMs > Date.now() + refreshBufferMs ? [id, value] as const : null;
  }));
  if (!current()) return deliveryResult([]);
  const entries = restored.filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  const resolvedIds = new Set(entries.map(([id]) => id));
  const missing = uniqueIds.filter((id) => !resolvedIds.has(id)).sort();
  const errors: Record<string, string> = {};

  try {
    // The backend accepts at most 50 IDs. Keep large restored feeds bounded and
    // coalesce repeated reads of the same batch rather than silently dropping IDs.
    for (let offset = 0; offset < missing.length; offset += 50) {
      const batch = missing.slice(offset, offset + 50);
      const fetched = await runCoalescedContentRequest(`${prefix}resolve|${revision}|${batch.join('|')}`, async () => {
        const fn = invokeBackendAction<{ uploadIds: string[] }, BackendDeliveryResult>('resolveUploadImageUrls', { timeoutMs: readRequestTimeoutMs });
        return await fn({ uploadIds: batch });
      });
      if (!current()) return deliveryResult([]);
      Object.assign(errors, fetched.errors);
      for (const id of batch) {
        if (!fetched.fullUrls[id] || !fetched.thumbnailUrls[id]) continue;
        const value: ImageReference = {
          expiresAtMs: Date.parse(fetched.expiresAtByUploadId[id]),
          fullUrl: fetched.fullUrls[id]!, thumbnailUrl: fetched.thumbnailUrls[id]!,
        };
        entries.push([id, value]);
        const entryGuard = { ...guard, key: cacheKey(id) };
        if (fetched.privateByUploadId[id] === false) {
          setCachedContentFromRead(entryGuard, value);
        } else {
          privateReferences.delete(id);
          privateReferences.set(id, { guard: entryGuard, value });
          while (privateReferences.size > 500) privateReferences.delete(privateReferences.keys().next().value!);
        }
      }
    }
    return deliveryResult(entries, errors);
  } catch (error) {
    throw toReadableBackendError(error);
  }
}
