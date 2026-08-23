import { describe, expect, it } from "vitest";
import {
  PERSISTENT_CACHE_MAX_AGE_MS,
  PERSISTENT_CACHE_MAX_BYTES,
  PERSISTENT_CACHE_MAX_ENTRIES,
  shouldPrunePersistentCacheEntry,
} from "../../src/lib/persistent-cache";

describe("persistent cache policy", () => {
  const now = Date.UTC(2026, 7, 23);

  it("keeps a fresh entry while the cache is within both budgets", () => {
    expect(shouldPrunePersistentCacheEntry({
      entryCount: PERSISTENT_CACHE_MAX_ENTRIES,
      now,
      oldestUpdatedAt: now - PERSISTENT_CACHE_MAX_AGE_MS + 1,
      totalBytes: PERSISTENT_CACHE_MAX_BYTES,
    })).toBe(false);
  });

  it.each([
    {
      entryCount: PERSISTENT_CACHE_MAX_ENTRIES + 1,
      oldestUpdatedAt: now,
      totalBytes: PERSISTENT_CACHE_MAX_BYTES,
    },
    {
      entryCount: PERSISTENT_CACHE_MAX_ENTRIES,
      oldestUpdatedAt: now,
      totalBytes: PERSISTENT_CACHE_MAX_BYTES + 1,
    },
    {
      entryCount: PERSISTENT_CACHE_MAX_ENTRIES,
      oldestUpdatedAt: now - PERSISTENT_CACHE_MAX_AGE_MS,
      totalBytes: PERSISTENT_CACHE_MAX_BYTES,
    },
  ])("prunes the oldest entry when a policy boundary is exceeded", (input) => {
    expect(shouldPrunePersistentCacheEntry({ ...input, now })).toBe(true);
  });
});
