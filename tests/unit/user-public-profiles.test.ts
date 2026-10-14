import { beforeEach, expect, it, vi } from "vitest";
import { fetchUserPublicProfiles, getCachedUserPublicProfiles } from "@/services/users-read";
import { queryClient } from "@/lib/query-client";

const fetch = vi.hoisted(() => vi.fn());
vi.mock("@/services/backend-action", () => ({ callAction: (_name: string, payload: unknown) => fetch(payload) }));
vi.mock("@/services/backend-errors", () => ({ toReadableBackendError: (error: unknown) => error }));
beforeEach(() => { fetch.mockReset(); queryClient.clear(); });

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

it("reads a cached profile without asking again", async () => {
  fetch.mockResolvedValue({ profiles: { author: { uid: "author", displayName: "Author", photoUrl: null, version: 1 } } });
  await fetchUserPublicProfiles(["author"]);
  await fetchUserPublicProfiles(["author"]);
  expect(fetch).toHaveBeenCalledOnce();
});
