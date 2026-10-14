import { callAction } from '@/services/backend-action';
import { readRequestTimeoutMs } from '@/lib/request';
import { toReadableBackendError } from './issues-core';
import {
  captureContentCacheWriteGuard, CONTENT_SHORT_CACHE_TTL_MS, getCachedContent,
  getCachedContentPersistent, isContentCacheWriteGuardCurrent, markContentCachePrefixStale,
  runCoalescedContentRequest, setCachedContentFromRead, subscribeContentCacheInvalidations,
  type ContentCacheWriteGuard,
} from './content-read-cache';

export interface ImageReference {
  expiresAtMs: number;
  fullUrl: string;
  thumbnailUrl: string;
}

/** The images that can be shown, by upload id. One that cannot is absent. */
export type ResolvedImages = Record<string, ImageReference>;

const prefix = 'upload-media-v2|';
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

function invalidateResolvedUploadCache(ids: string[]) {
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

export async function resolveUploadImageUrls(ids: string[], options: { forceRefresh?: boolean } = {}): Promise<ResolvedImages> {
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
  if (!current()) return {};
  const entries = restored.filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  const resolvedIds = new Set(entries.map(([id]) => id));
  const missing = uniqueIds.filter((id) => !resolvedIds.has(id)).sort();

  try {
    // The backend accepts at most 50 IDs. Keep large restored feeds bounded and
    // coalesce repeated reads of the same batch rather than silently dropping IDs.
    for (let offset = 0; offset < missing.length; offset += 50) {
      const batch = missing.slice(offset, offset + 50);
      const fetched = await runCoalescedContentRequest(`${prefix}resolve|${revision}|${batch.join('|')}`, async () => {
        return await callAction('resolveUploadImageUrls', { uploadIds: batch }, { timeoutMs: readRequestTimeoutMs });
      });
      if (!current()) return {};
      for (const [id, image] of Object.entries(fetched.images)) {
        const value: ImageReference = {
          expiresAtMs: Date.parse(image.expiresAt),
          fullUrl: image.fullUrl,
          thumbnailUrl: image.thumbnailUrl,
        };
        entries.push([id, value]);
        const entryGuard = { ...guard, key: cacheKey(id) };
        if (!image.privateDelivery) {
          setCachedContentFromRead(entryGuard, value);
        } else {
          privateReferences.delete(id);
          privateReferences.set(id, { guard: entryGuard, value });
          while (privateReferences.size > 500) privateReferences.delete(privateReferences.keys().next().value!);
        }
      }
    }
    return Object.fromEntries(entries);
  } catch (error) {
    throw toReadableBackendError(error);
  }
}
