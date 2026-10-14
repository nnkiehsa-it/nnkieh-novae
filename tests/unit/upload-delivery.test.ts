import { beforeEach, expect, it, vi } from "vitest";
import { clearResolvedUploadCache, getResolvedUploadReference, resolveUploadImageUrls } from "@/services/upload-delivery";
import { invalidate, queryClient } from "@/lib/query-client";

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/services/backend-action", () => ({ callAction: (_name: string, payload: unknown) => mocks.fetch(payload) }));
vi.mock("@/services/backend-errors", () => ({ toReadableBackendError: (error: unknown) => error }));

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
  clearResolvedUploadCache();
  queryClient.clear();
  mocks.fetch.mockReset();
  mocks.fetch.mockImplementation(async ({ uploadIds }: { uploadIds: string[] }) => response(uploadIds));
});

it("keeps public references in the query cache and private links only in memory", async () => {
  await resolveUploadImageUrls(["public", "private"]);
  expect(queryClient.getQueryData(["uploads", "public"])).toMatchObject({ fullUrl: expect.stringContaining("/public/full") });
  expect(queryClient.getQueryData(["uploads", "private"])).toBeUndefined();
  expect(getResolvedUploadReference("private")?.fullUrl).toContain("/private/full");
  clearResolvedUploadCache();
  expect(getResolvedUploadReference("public")).toBeNull();
  expect(getResolvedUploadReference("private")).toBeNull();
});

it("coalesces concurrent batches and resolves every ID beyond the backend's 50-image limit", async () => {
  const ids = Array.from({ length: 51 }, (_, index) => `image-${index}`);
  const [first, second] = await Promise.all([resolveUploadImageUrls(ids), resolveUploadImageUrls(ids)]);
  expect(Object.keys(first)).toHaveLength(51);
  expect(second).toEqual(first);
  expect(mocks.fetch).toHaveBeenCalledTimes(2);
});

it("forgets references when content changes and does not keep an answer requested before", async () => {
  let finish!: (value: ReturnType<typeof response>) => void;
  mocks.fetch.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const pending = resolveUploadImageUrls(["public"]);
  await vi.waitFor(() => expect(mocks.fetch).toHaveBeenCalledOnce());
  queryClient.setQueryData(["issues", "detail", "issue"], { id: "issue" });
  await invalidate(["issues", "detail", "issue"]);
  await Promise.resolve();
  finish(response(["public"]));
  expect(await pending).toEqual({});
  expect(getResolvedUploadReference("public")).toBeNull();
  expect(queryClient.getQueryData(["uploads", "public"])).toBeUndefined();
});
