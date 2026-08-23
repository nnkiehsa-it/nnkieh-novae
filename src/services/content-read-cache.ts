import {
  clearPersistentCacheScope,
  deletePersistentCacheIfVersion,
  deletePersistentCacheByPrefix,
  readPersistentCache,
  writePersistentCache,
} from '@/lib/persistent-cache';
import { invalidateViewMemoryByDependency } from '@/lib/view-memory-cache';

export const CONTENT_READ_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1_000;
export const CONTENT_SHORT_CACHE_TTL_MS = 10 * 60 * 1_000;

interface CacheEntry<T> {
  stale: boolean;
  updatedAt: number;
  value: T;
}

const cache = new Map<string, CacheEntry<unknown>>();
const pendingPersistentReads = new Map<string, Promise<unknown | null>>();
const pendingRequests = new Map<string, Promise<unknown>>();
const pendingInvalidations = new Map<string, Promise<void>>();
const invalidationVersions = new Map<string, number>();
const invalidationListeners = new Set<(prefix: string) => void>();
const MAX_MEMORY_CACHE_ENTRIES = 2_000;
let activeScope = 'anonymous';
let cacheVersion = 0;
let persistentWriteVersion = 0;
let scopeVersion = 0;

function notifyContentCacheInvalidation(prefix: string) {
  invalidationListeners.forEach((listener) => {
    try {
      listener(prefix);
    } catch {
      // Cache invalidation observers must never turn an already committed
      // backend mutation into a client-visible write failure.
    }
  });
}

export interface ContentCacheWriteGuard {
  cacheVersion: number;
  key: string;
  scope: string;
  scopeVersion: number;
}

function scopedKey(key: string) {
  return `${activeScope}\u0000${key}`;
}

function rememberContentCacheEntry(key: string, entry: CacheEntry<unknown>) {
  cache.delete(key);
  cache.set(key, entry);
  while (cache.size > MAX_MEMORY_CACHE_ENTRIES) {
    const leastRecentlyUsedKey = cache.keys().next().value;
    if (typeof leastRecentlyUsedKey !== 'string') break;
    cache.delete(leastRecentlyUsedKey);
  }
}

export function setContentCacheScope(scope: string) {
  const normalized = scope.trim() || 'anonymous';
  if (normalized === activeScope) return;
  activeScope = normalized;
  scopeVersion += 1;
  cache.clear();
  pendingPersistentReads.clear();
  pendingRequests.clear();
  invalidationVersions.clear();
}

export function createContentCacheKey(parts: Array<string | number | boolean | null | undefined>) {
  return parts.map((part) => {
    if (part === null) return 'null';
    if (part === undefined) return 'undefined';
    return String(part);
  }).join('|');
}

export function isContentCacheFresh(updatedAt: number, now = Date.now(), maxAgeMs = CONTENT_READ_CACHE_TTL_MS) {
  return now - updatedAt < maxAgeMs;
}

export function getCachedContent<T>(key: string, maxAgeMs = CONTENT_READ_CACHE_TTL_MS): T | null {
  const entry = cache.get(key);
  if (!entry || entry.stale || !isContentCacheFresh(entry.updatedAt, Date.now(), maxAgeMs)) return null;
  rememberContentCacheEntry(key, entry);
  return entry.value as T;
}

export async function getCachedContentPersistent<T>(key: string, maxAgeMs = CONTENT_READ_CACHE_TTL_MS) {
  const memoryCached = getCachedContent<T>(key, maxAgeMs);
  if (memoryCached) return memoryCached;

  const persistentKey = scopedKey(key);
  const relevantInvalidations = Array.from(pendingInvalidations.entries())
    .filter(([invalidationKey]) => {
      const separatorIndex = invalidationKey.indexOf('\u0000');
      return invalidationKey.slice(0, separatorIndex) === activeScope
        && key.startsWith(invalidationKey.slice(separatorIndex + 1));
    })
    .map(([, pending]) => pending);
  if (relevantInvalidations.length > 0) await Promise.all(relevantInvalidations);
  const existing = pendingPersistentReads.get(persistentKey);
  if (existing) return await existing as T | null;

  const guard = captureContentCacheWriteGuard(key);
  const pending = readPersistentCache<T>(persistentKey).then((entry) => {
    if (!entry || entry.scope !== guard.scope) return null;
    if (!isContentCacheFresh(entry.updatedAt, Date.now(), maxAgeMs)) {
      if (entry.writeVersion !== undefined)
        void deletePersistentCacheIfVersion(persistentKey, entry.writeVersion);
      return null;
    }
    if (!isContentCacheWriteGuardCurrent(guard)) return null;
    rememberContentCacheEntry(key, { stale: false, updatedAt: entry.updatedAt, value: entry.value });
    return entry.value;
  }).finally(() => {
    if (pendingPersistentReads.get(persistentKey) === pending) pendingPersistentReads.delete(persistentKey);
  });
  pendingPersistentReads.set(persistentKey, pending);
  return await pending;
}

export function getCachedContentEntry<T>(key: string) {
  const entry = cache.get(key);
  if (!entry) return null;
  return { stale: entry.stale, updatedAt: entry.updatedAt, value: entry.value as T };
}

export function setCachedContent<T>(key: string, value: T, updatedAt = Date.now()) {
  writeCachedContent(key, value, updatedAt, captureContentCacheWriteGuard(key));
}

export function captureContentCacheWriteGuard(key: string): ContentCacheWriteGuard {
  return { cacheVersion, key, scope: activeScope, scopeVersion };
}

export function setCachedContentFromRead<T>(guard: ContentCacheWriteGuard, value: T, updatedAt = Date.now()) {
  if (!isContentCacheWriteGuardCurrent(guard)) return false;
  writeCachedContent(guard.key, value, updatedAt, guard);
  return true;
}

function writeCachedContent<T>(key: string, value: T, updatedAt: number, guard: ContentCacheWriteGuard) {
  rememberContentCacheEntry(key, { stale: false, updatedAt, value });
  const scope = activeScope;
  const persistentKey = `${scope}\u0000${key}`;
  const writeVersion = ++persistentWriteVersion;
  void writePersistentCache({ cacheKey: key, key: persistentKey, scope, updatedAt, value, writeVersion })
    .then(() => {
      if (!isContentCacheWriteGuardCurrent(guard)) {
        return deletePersistentCacheIfVersion(persistentKey, writeVersion);
      }
    });

}

export function runCoalescedContentRequest<T>(key: string, request: (guard: ContentCacheWriteGuard) => Promise<T>) {
  const guard = captureContentCacheWriteGuard(key);
  const scopedRequestKey = `${guard.scope}\u0000${guard.scopeVersion}\u0000${key}`;
  const existing = pendingRequests.get(scopedRequestKey);
  if (existing) return existing as Promise<T>;
  const pending = request(guard).finally(() => {
    if (pendingRequests.get(scopedRequestKey) === pending) pendingRequests.delete(scopedRequestKey);
  });
  pendingRequests.set(scopedRequestKey, pending);
  return pending;
}

export function patchCachedContent<T>(key: string, updater: (value: T) => T) {
  const entry = cache.get(key);
  if (!entry) return;
  setCachedContent(key, updater(entry.value as T));
}

export function markContentCacheStale(predicate: (key: string) => boolean) {
  cache.forEach((entry, key) => {
    if (predicate(key)) entry.stale = true;
  });
}

export function markContentCachePrefixStale(prefix: string) {
  markContentCacheStale((key) => key.startsWith(prefix));
  invalidateViewMemoryByDependency(prefix);
  notifyContentCacheInvalidation(prefix);
  const scope = activeScope;
  cacheVersion += 1;
  invalidationVersions.set(`${scope}\u0000${prefix}`, cacheVersion);
  const invalidationKey = `${scope}\u0000${prefix}`;
  const previous = pendingInvalidations.get(invalidationKey) ?? Promise.resolve();
  const pending = previous
    .then(() => deletePersistentCacheByPrefix(scope, prefix))
    .finally(() => {
      if (pendingInvalidations.get(invalidationKey) === pending) pendingInvalidations.delete(invalidationKey);
    });
  pendingInvalidations.set(invalidationKey, pending);
}

export function subscribeContentCacheInvalidations(listener: (prefix: string) => void) {
  invalidationListeners.add(listener);
  return () => invalidationListeners.delete(listener);
}

export function clearContentReadMemoryCache() {
  scopeVersion += 1;
  cache.clear();
  pendingPersistentReads.clear();
  pendingRequests.clear();
  invalidationVersions.clear();
}

export function clearContentReadCache() {
  const scope = activeScope;
  clearContentReadMemoryCache();
  void clearPersistentCacheScope(scope);
}

function isContentCacheWriteGuardCurrent(guard: ContentCacheWriteGuard) {
  if (guard.scope !== activeScope || guard.scopeVersion !== scopeVersion) return false;
  for (const [invalidationKey, version] of invalidationVersions) {
    if (version <= guard.cacheVersion) continue;
    const separatorIndex = invalidationKey.indexOf('\u0000');
    if (
      invalidationKey.slice(0, separatorIndex) === guard.scope
      && guard.key.startsWith(invalidationKey.slice(separatorIndex + 1))
    ) return false;
  }
  return true;
}
