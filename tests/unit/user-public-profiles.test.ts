import { beforeEach, expect, it, vi } from "vitest";
import { fetchUserPublicProfiles, getCachedUserPublicProfiles } from "@/services/users-read";
import { clearContentReadMemoryCache, setContentCacheScope } from "@/services/content-read-cache";

const fetch = vi.hoisted(() => vi.fn());
vi.mock("@/services/backend-action", () => ({ invokeBackendAction: () => fetch }));
vi.mock("@/services/issues-core", () => ({ toReadableBackendError: (error: unknown) => error }));
vi.mock("@/lib/persistent-cache", () => ({
  readPersistentCache: async () => undefined, writePersistentCache: vi.fn(async () => {}),
  deletePersistentCacheIfVersion: vi.fn(),
}));
beforeEach(() => { fetch.mockReset(); clearContentReadMemoryCache(); setContentCacheScope("alice"); });

it("fetches all authors in bounded coalesced batches rather than dropping everyone beyond fifty", async () => {
  const ids = Array.from({ length: 51 }, (_, index) => `author-${index}`);
  fetch.mockImplementation(async ({ uids }: { uids: string[] }) => ({
    profiles: Object.fromEntries(uids.map((uid) => [uid, { uid, displayName: uid, photoUrl: null, version: 1 }])),
  }));
  const [first, second] = await Promise.all([fetchUserPublicProfiles(ids), fetchUserPublicProfiles(ids)]);
  expect(Object.keys(first)).toHaveLength(51);
  expect(second).toEqual(first);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(Object.keys(getCachedUserPublicProfiles(ids))).toHaveLength(51);
});

it("does not seed the next account with a profile read started before an account switch", async () => {
  let finish!: (value: unknown) => void;
  fetch.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const pending = fetchUserPublicProfiles(["author"]);
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
  setContentCacheScope("bob");
  finish({ profiles: { author: { uid: "author", displayName: "Author", photoUrl: null, version: 1 } } });
  expect(await pending).toEqual({});
  expect(getCachedUserPublicProfiles(["author"])).toEqual({});
});
