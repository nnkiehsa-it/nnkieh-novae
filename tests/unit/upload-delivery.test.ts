import { beforeEach, expect, it, vi } from "vitest";
import { resolveUploadImageUrls, getResolvedUploadReference } from "@/services/upload-delivery";
import { clearContentReadMemoryCache, markContentCachePrefixStale, restoreContentReadCache, setContentCacheScope } from "@/services/content-read-cache";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(), stored: new Map<string, { key: string; cacheKey: string; scope: string; value: unknown; updatedAt: number }>(),
}));
vi.mock("@/services/backend-action", () => ({ callAction: (_name: string, payload: unknown) => mocks.fetch(payload) }));
vi.mock("@/services/backend-errors", () => ({ toReadableBackendError: (error: unknown) => error }));
vi.mock("@/lib/persistent-cache", () => ({
  writePersistentCache: async (entry: { key: string; cacheKey: string; scope: string; value: unknown; updatedAt: number }) => { mocks.stored.set(entry.key, entry); },
  readPersistentCache: async (key: string) => mocks.stored.get(key),
  readPersistentCachePrefix: async (scope: string) => [...mocks.stored.values()].filter((entry) => entry.scope === scope),
  deletePersistentCacheByPrefix: async (scope: string, prefix: string) => {
    for (const [key, entry] of mocks.stored) if (entry.scope === scope && entry.cacheKey.startsWith(prefix)) mocks.stored.delete(key);
  },
  deletePersistentCacheIfVersion: vi.fn(), clearPersistentCacheScope: vi.fn(),
}));
vi.mock("@/lib/view-memory-cache", () => ({ invalidateViewMemoryByDependency: vi.fn() }));

function response(ids: string[]) {
  return {
    images: Object.fromEntries(ids.map((id) => [id, {
      expiresAt: "9999-12-31T23:59:59.000Z",
      fullUrl: `https://media.example/${id}/full`,
      privateDelivery: id === "private",
      thumbnailUrl: `https://media.example/${id}/thumbnail`,
    }])),
  };
}
beforeEach(() => {
  mocks.stored.clear(); mocks.fetch.mockReset(); clearContentReadMemoryCache(); setContentCacheScope("alice");
  mocks.fetch.mockImplementation(async ({ uploadIds }: { uploadIds: string[] }) => response(uploadIds));
});

it("restores public references synchronously while keeping private URLs and other accounts out of persistence", async () => {
  await resolveUploadImageUrls(["public", "private"]);
  expect([...mocks.stored.values()].map((entry) => entry.cacheKey)).toEqual(["upload-media-v2|public"]);
  clearContentReadMemoryCache(); await restoreContentReadCache();
  expect(getResolvedUploadReference("public")?.fullUrl).toContain("/public/full");
  expect(getResolvedUploadReference("private")).toBeNull();
  setContentCacheScope("bob"); await restoreContentReadCache();
  expect(getResolvedUploadReference("public")).toBeNull();
});

it("coalesces concurrent batches and resolves every ID beyond the backend's 50-image limit", async () => {
  const ids = Array.from({ length: 51 }, (_, index) => `image-${index}`);
  const [first, second] = await Promise.all([resolveUploadImageUrls(ids), resolveUploadImageUrls(ids)]);
  expect(Object.keys(first)).toHaveLength(51);
  expect(second).toEqual(first);
  expect(mocks.fetch).toHaveBeenCalledTimes(2);
});

it("invalidates inherited access and does not resurrect references from an older request", async () => {
  let finish!: (value: ReturnType<typeof response>) => void;
  mocks.fetch.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const pending = resolveUploadImageUrls(["public"]);
  await vi.waitFor(() => expect(mocks.fetch).toHaveBeenCalledOnce());
  markContentCachePrefixStale("issue-detail|");
  finish(response(["public"]));
  expect(await pending).toEqual({});
  expect(getResolvedUploadReference("public")).toBeNull();
  expect(mocks.stored.size).toBe(0);
});
