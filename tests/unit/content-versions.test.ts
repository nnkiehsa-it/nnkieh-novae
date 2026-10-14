import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ invalidateDomain: vi.fn() }));

vi.mock("@/lib/firebase", () => ({
  auth: { currentUser: { uid: "admin-uid" } },
}));

vi.mock("@/lib/query-client", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/query-client")>(),
  invalidateDomain: mocks.invalidateDomain,
}));

import { queryClient } from "@/lib/query-client";
import { applyContentVersionsSnapshot, registerContentVersion } from "@/services/content-versions";

describe("content version reconciliation", () => {
  beforeEach(() => {
    mocks.invalidateDomain.mockClear();
    queryClient.clear();
  });

  it("invalidates cached content when the authoritative version decreases after reset", () => {
    applyContentVersionsSnapshot({ announcements: 31, facilities: 19, issues: 47 });
    mocks.invalidateDomain.mockClear();

    const changed = applyContentVersionsSnapshot({ announcements: 31, facilities: 19, issues: 2 });

    expect(changed).toEqual(["issues"]);
    expect(mocks.invalidateDomain).toHaveBeenCalledExactlyOnceWith("issues");
  });

  it("keeps caches only when the cached and authoritative versions are equal", () => {
    const versions = { announcements: 31, facilities: 19, issues: 47 };
    applyContentVersionsSnapshot(versions);
    mocks.invalidateDomain.mockClear();

    expect(applyContentVersionsSnapshot(versions)).toEqual([]);
    expect(mocks.invalidateDomain).not.toHaveBeenCalled();
  });

  it("treats every domain as changed when nothing was cached", () => {
    expect(applyContentVersionsSnapshot({ announcements: 1, facilities: 1, issues: 1 }))
      .toEqual(["announcements", "facilities", "issues"]);
  });

  it("records a newer version read with an answer, and never an older one", () => {
    applyContentVersionsSnapshot({ announcements: 3, facilities: 3, issues: 3 });
    registerContentVersion("issues", 5);
    registerContentVersion("issues", 4);
    mocks.invalidateDomain.mockClear();
    expect(applyContentVersionsSnapshot({ announcements: 3, facilities: 3, issues: 5 })).toEqual([]);
  });
});
