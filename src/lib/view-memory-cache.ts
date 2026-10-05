import { getOperationPolicy } from './operation-policies';
import { deletePersistentCacheByPrefix, deletePersistentCacheMatching, PERSISTENT_CACHE_MAX_AGE_MS, readPersistentCachePrefix, writePersistentCache } from './persistent-cache';

interface ViewMemoryEntry<T> {
  dependencies: readonly string[];
  updatedAt: number;
  value: T;
  restored?: boolean;
}

const entries = new Map<string, ViewMemoryEntry<unknown>>();
const STORAGE_PREFIX = 'view-memory|';
let storageQueue = Promise.resolve();
let revision = 0;

function persist(operation: () => Promise<void>) {
  // Order saves and invalidations so a late save cannot resurrect deleted data.
  storageQueue = storageQueue.then(operation);
}

export async function restoreViewMemoryScope(scope: string) {
  const readRevision = revision;
  await storageQueue;
  const stored = await readPersistentCachePrefix<ViewMemoryEntry<unknown>>(scope, STORAGE_PREFIX);
  if (revision !== readRevision) return;
  for (const entry of stored.toSorted((left, right) => left.updatedAt - right.updatedAt).slice(-getOperationPolicy('viewMemoryEntries'))) {
    if (Date.now() - entry.updatedAt >= PERSISTENT_CACHE_MAX_AGE_MS) continue;
    const key = scopedKey(scope, entry.cacheKey.slice(STORAGE_PREFIX.length));
    if (!entries.has(key)) entries.set(key, { ...entry.value, restored: true });
  }
}

export function needsViewMemoryRefresh(scope: string | undefined, key: string) {
  return entries.get(scopedKey(scope, key))?.restored === true;
}

function scopedKey(scope: string | undefined, key: string) {
  return `${scope?.trim() || "anonymous"}|${key}`;
}

export function getViewMemory<T>(
  scope: string | undefined,
  key: string,
): T | null {
  const cacheKey = scopedKey(scope, key);
  const entry = entries.get(cacheKey);
  if (!entry) return null;
  const maxAge = entry.restored ? PERSISTENT_CACHE_MAX_AGE_MS : getOperationPolicy('viewMemoryMinutes') * 60_000;
  if (Date.now() - entry.updatedAt >= maxAge) return null;
  return entry.value as T;
}

export function setViewMemory<T>(
  scope: string | undefined,
  key: string,
  value: T,
  dependencies: readonly string[] = [],
) {
  const cacheKey = scopedKey(scope, key);
  const now = Date.now();
  for (const [existingKey, entry] of entries) {
    const maxAge = entry.restored ? PERSISTENT_CACHE_MAX_AGE_MS : getOperationPolicy('viewMemoryMinutes') * 60_000;
    if (now - entry.updatedAt >= maxAge)
      entries.delete(existingKey);
  }
  entries.delete(cacheKey);
  entries.set(cacheKey, { dependencies, updatedAt: now, value });
  if (scope) {
    const persistentKey = `${STORAGE_PREFIX}${key}`;
    persist(() => writePersistentCache({ cacheKey: persistentKey, key: `${scope}\u0000${persistentKey}`, scope, updatedAt: now, value: { dependencies, updatedAt: now, value } }));
  }
  while (entries.size > getOperationPolicy('viewMemoryEntries')) {
    const oldest = entries.keys().next().value;
    if (typeof oldest !== "string") break;
    entries.delete(oldest);
  }
}

export function invalidateViewMemoryByDependency(prefix: string, scope?: string) {
  revision += 1;
  const scopes = new Set(scope ? [scope] : []);
  const matches = (entry: ViewMemoryEntry<unknown>) => entry.dependencies.some((dependency) => prefix.startsWith(dependency) || dependency.startsWith(prefix));
  for (const [key, entry] of entries) {
    const entryScope = key.slice(0, key.indexOf('|'));
    if (scope && entryScope !== scope) continue;
    if (matches(entry)) {
      entries.delete(key);
      scopes.add(entryScope);
    }
  }
  for (const entryScope of scopes) persist(() => deletePersistentCacheMatching(entryScope, (entry) => entry.cacheKey.startsWith(STORAGE_PREFIX) && matches(entry.value as ViewMemoryEntry<unknown>)));
}

export function clearViewMemoryScope(scope: string | undefined) {
  revision += 1;
  if (scope) persist(() => deletePersistentCacheByPrefix(scope, STORAGE_PREFIX));
  const prefix = `${scope?.trim() || "anonymous"}|`;
  for (const key of entries.keys()) {
    if (key.startsWith(prefix)) entries.delete(key);
  }
}
