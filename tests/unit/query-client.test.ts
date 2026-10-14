import { afterEach, expect, it } from "vitest";
import { dropEntity, invalidateLists, patchEntity, queryClient } from "@/lib/query-client";

afterEach(() => queryClient.clear());

it("keeps an answer no screen is showing yet, such as the session bootstrap", async () => {
  queryClient.setQueryData(["session", "bootstrap"], { ready: true });
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(queryClient.getQueryData(["session", "bootstrap"])).toEqual({ ready: true });
});

it("changes a record in every list page and detail that holds it, and nothing else", () => {
  const other = { id: "other", supportCount: 1 };
  queryClient.setQueryData(["issues", "list", { filter: "a" }], {
    pages: [{ issues: [{ id: "issue", supportCount: 1 }, other] }],
    pageParams: [null],
  });
  queryClient.setQueryData(["issues", "detail", "issue"], { id: "issue", supportCount: 1, content: "body" });
  patchEntity("issues", "issue", { supportCount: 2 });
  const list = queryClient.getQueryData<{ pages: Array<{ issues: Array<{ id: string; supportCount: number }> }> }>(
    ["issues", "list", { filter: "a" }],
  )!;
  expect(list.pages[0].issues[0].supportCount).toBe(2);
  expect(list.pages[0].issues[1]).toBe(other);
  expect(queryClient.getQueryData(["issues", "detail", "issue"])).toEqual({ id: "issue", supportCount: 2, content: "body" });
});

it("drops a deleted record from lists while its detail stays for the screen that is leaving", () => {
  queryClient.setQueryData(["facilities", "list", {}], { pages: [{ facilities: [{ id: "gone" }, { id: "kept" }] }], pageParams: [null] });
  queryClient.setQueryData(["facilities", "detail", "gone"], { id: "gone" });
  dropEntity("facilities", "gone");
  expect(queryClient.getQueryData(["facilities", "list", {}])).toEqual({ pages: [{ facilities: [{ id: "kept" }] }], pageParams: [null] });
  expect(queryClient.getQueryData(["facilities", "detail", "gone"])).toEqual({ id: "gone" });
});

it("starts a stale list over from its first page", async () => {
  queryClient.setQueryData(["announcements", "list"], { pages: [{ n: 1 }, { n: 2 }], pageParams: [null, "next"] });
  await invalidateLists("announcements");
  expect(queryClient.getQueryData(["announcements", "list"])).toEqual({ pages: [{ n: 1 }], pageParams: [null] });
  expect(queryClient.getQueryState(["announcements", "list"])?.isInvalidated).toBe(true);
});
