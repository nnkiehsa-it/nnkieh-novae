import { beforeEach, expect, it, vi } from "vitest";

const stored = vi.hoisted(() => new Map<string, { cacheKey: string; key: string; scope: string; updatedAt: number; value: unknown }>());
vi.mock("@/lib/persistent-cache", () => ({
  PERSISTENT_CACHE_MAX_AGE_MS: 30 * 24 * 60 * 60_000,
  writePersistentCache: async (entry: { cacheKey: string; key: string; scope: string; updatedAt: number; value: unknown }) => { stored.set(entry.key, structuredClone(entry)); },
  readPersistentCachePrefix: async (scope: string, prefix: string) => [...stored.values()].filter((entry) => entry.scope === scope && entry.cacheKey.startsWith(prefix)),
  deletePersistentCacheByPrefix: async (scope: string, prefix: string) => {
    for (const [key, entry] of stored) if (entry.scope === scope && entry.cacheKey.startsWith(prefix)) stored.delete(key);
  },
  deletePersistentCacheMatching: async (scope: string, matches: (entry: unknown) => boolean) => {
    for (const [key, entry] of stored) if (entry.scope === scope && matches(entry)) stored.delete(key);
  },
}));

beforeEach(() => { vi.resetModules(); stored.clear(); });

it("restores the previous screen after a reload, preserving Dates and account isolation", async () => {
  let cache = await import("../../src/lib/view-memory-cache");
  const value = { count: 12, createdAt: new Date("2026-10-01T00:00:00Z") };
  cache.setViewMemory("alice", "home", value, ["issue-list-page|"]);
  await cache.restoreViewMemoryScope("alice");
  vi.resetModules();
  cache = await import("../../src/lib/view-memory-cache");
  await cache.restoreViewMemoryScope("bob");
  expect(cache.getViewMemory("bob", "home")).toBeNull();
  await cache.restoreViewMemoryScope("alice");
  expect(cache.getViewMemory("alice", "home")).toEqual(value);
  expect(cache.needsViewMemoryRefresh("alice", "home")).toBe(true);
});

it("orders pending saves before invalidation and clears persisted screens on logout", async () => {
  let cache = await import("../../src/lib/view-memory-cache");
  cache.setViewMemory("alice", "feed", { count: 2 }, ["issue-list-page|"]);
  cache.invalidateViewMemoryByDependency("issue-list-page|");
  await cache.restoreViewMemoryScope("alice");
  expect(cache.getViewMemory("alice", "feed")).toBeNull();
  cache.setViewMemory("alice", "settings", { enabled: true });
  cache.clearViewMemoryScope("alice");
  await cache.restoreViewMemoryScope("alice");
  vi.resetModules();
  cache = await import("../../src/lib/view-memory-cache");
  await cache.restoreViewMemoryScope("alice");
  expect(cache.getViewMemory("alice", "settings")).toBeNull();
});
