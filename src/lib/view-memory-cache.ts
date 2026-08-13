const VIEW_MEMORY_TTL_MS = 30 * 60 * 1_000;
const MAX_VIEW_MEMORY_ENTRIES = 100;

interface ViewMemoryEntry<T> {
  dependencies: readonly string[];
  updatedAt: number;
  value: T;
}

const entries = new Map<string, ViewMemoryEntry<unknown>>();

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
  if (Date.now() - entry.updatedAt >= VIEW_MEMORY_TTL_MS) return null;
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
    if (now - entry.updatedAt >= VIEW_MEMORY_TTL_MS)
      entries.delete(existingKey);
  }
  entries.delete(cacheKey);
  entries.set(cacheKey, { dependencies, updatedAt: now, value });
  while (entries.size > MAX_VIEW_MEMORY_ENTRIES) {
    const oldest = entries.keys().next().value;
    if (typeof oldest !== "string") break;
    entries.delete(oldest);
  }
}

export function invalidateViewMemoryByDependency(prefix: string) {
  for (const [key, entry] of entries) {
    if (
      entry.dependencies.some(
        (dependency) =>
          prefix.startsWith(dependency) || dependency.startsWith(prefix),
      )
    ) {
      entries.delete(key);
    }
  }
}

export function clearViewMemoryScope(scope: string | undefined) {
  const prefix = `${scope?.trim() || "anonymous"}|`;
  for (const key of entries.keys()) {
    if (key.startsWith(prefix)) entries.delete(key);
  }
}
