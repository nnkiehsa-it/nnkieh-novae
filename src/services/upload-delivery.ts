import { callAction } from '@/services/backend-action';
import { readRequestTimeoutMs } from '@/lib/request';
import { queryClient } from '@/lib/query-client';
import { toReadableBackendError } from './backend-errors';

export interface ImageReference {
  expiresAtMs: number;
  fullUrl: string;
  thumbnailUrl: string;
}

/** The images that can be shown, by upload id. One that cannot is absent. */
export type ResolvedImages = Record<string, ImageReference>;

export const REFERENCE_MAX_AGE_MS = 10 * 60 * 1_000;
const REFRESH_BUFFER_MS = 60_000;
const BATCH_SIZE = 50;
const referenceKey = (id: string) => ['uploads', id] as const;
// A private image's signed link is never written to disk; it lives as long as the tab.
const privateReferences = new Map<string, ImageReference>();
const pendingBatches = new Map<string, Promise<ResolvedImages>>();
// Raised on every clear, so an answer requested before it is not kept.
let generation = 0;

export function clearResolvedUploadCache() {
  generation += 1;
  privateReferences.clear();
  void queryClient.invalidateQueries({ queryKey: ['uploads'] });
}

// An attachment inherits visibility from its content, so content that changed
// makes every reference stale, public and private alike.
const CONTENT_ROOTS = new Set(['issues', 'facilities', 'announcements', 'categories']);
let clearScheduled = false;
queryClient.getQueryCache().subscribe((event) => {
  if (clearScheduled || event.type !== 'updated' || event.action.type !== 'invalidate') return;
  if (!CONTENT_ROOTS.has(String(event.query.queryKey[0]))) return;
  // One invalidation touches many queries; the references are cleared once for all of them.
  clearScheduled = true;
  queueMicrotask(() => {
    clearScheduled = false;
    clearResolvedUploadCache();
  });
});

function usable(reference: ImageReference | undefined) {
  return reference && reference.expiresAtMs > Date.now() + REFRESH_BUFFER_MS ? reference : null;
}

export function getResolvedUploadReference(id: string): ImageReference | null {
  const known = privateReferences.get(id);
  if (known) return usable(known);
  const state = queryClient.getQueryState<ImageReference>(referenceKey(id));
  if (!state?.data || state.isInvalidated || Date.now() - state.dataUpdatedAt >= REFERENCE_MAX_AGE_MS) return null;
  return usable(state.data);
}

function readBatch(batch: string[]) {
  const requested = generation;
  const key = `${requested}|${batch.join('|')}`;
  const existing = pendingBatches.get(key);
  if (existing) return existing;
  const pending = callAction('resolveUploadImageUrls', { uploadIds: batch }, { timeoutMs: readRequestTimeoutMs })
    .then(({ images }) => {
      const resolved: ResolvedImages = {};
      if (requested !== generation) return resolved;
      for (const [id, image] of Object.entries(images)) {
        const reference = { expiresAtMs: Date.parse(image.expiresAt), fullUrl: image.fullUrl, thumbnailUrl: image.thumbnailUrl };
        resolved[id] = reference;
        if (image.privateDelivery) privateReferences.set(id, reference);
        else queryClient.setQueryData(referenceKey(id), reference);
      }
      while (privateReferences.size > 500) privateReferences.delete(privateReferences.keys().next().value!);
      return resolved;
    })
    .finally(() => pendingBatches.delete(key));
  pendingBatches.set(key, pending);
  return pending;
}

/** Signed links for these uploads: those still good from the cache, the rest fifty to a request. */
export async function resolveUploadImageUrls(ids: string[], options: { forceRefresh?: boolean } = {}): Promise<ResolvedImages> {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  const images: ResolvedImages = {};
  if (!options.forceRefresh) {
    for (const id of uniqueIds) {
      const reference = getResolvedUploadReference(id);
      if (reference) images[id] = reference;
    }
  }
  const missing = uniqueIds.filter((id) => !images[id]).sort();
  try {
    for (let offset = 0; offset < missing.length; offset += BATCH_SIZE) {
      Object.assign(images, await readBatch(missing.slice(offset, offset + BATCH_SIZE)));
    }
    return images;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}
