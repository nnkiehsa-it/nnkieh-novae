import { beforeEach, expect, it, vi } from "vitest";
import type { SessionAccess } from "../../src/services/session";

vi.mock("@/services/backend-action", () => ({ callAction: vi.fn() }));

const access: SessionAccess = {
  role: "user", roles: ["proposal-manager"], permissions: ["proposal.manage", "category.manage"],
  managedFacilityCategoryIds: [], managedIssueCategoryIds: ["a", "b"], setupCompleted: true,
};

beforeEach(async () => {
  const { queryClient } = await import("../../src/lib/query-client");
  queryClient.clear();
});

it("reports a change the first time access is stored and whenever it differs", async () => {
  const { storeSessionAccess, getCachedSessionRole } = await import("../../src/services/session");
  expect(storeSessionAccess(access)).toBe(true);
  expect(storeSessionAccess({ ...access, permissions: [...access.permissions].reverse(), managedIssueCategoryIds: ["b", "a"] })).toBe(false);
  expect(storeSessionAccess({ ...access, managedIssueCategoryIds: ["a"] })).toBe(true);
  expect(storeSessionAccess({ ...access, role: "admin" })).toBe(true);
  expect(getCachedSessionRole()).toBe("admin");
});

it("drops answers read under the old access but keeps session and remembered state", async () => {
  const { queryClient, resetAccessDependentQueries } = await import("../../src/lib/query-client");
  queryClient.setQueryData(["issues", "list", {}], { pages: [[{ id: "1" }]] });
  queryClient.setQueryData(["session", "access"], access);
  queryClient.setQueryData(["remembered", "tab"], "closed");
  await resetAccessDependentQueries();
  expect(queryClient.getQueryData(["issues", "list", {}])).toBeUndefined();
  expect(queryClient.getQueryData(["session", "access"])).toEqual(access);
  expect(queryClient.getQueryData(["remembered", "tab"])).toBe("closed");
});
