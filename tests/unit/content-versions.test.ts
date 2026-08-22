import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clearContentEntityDomain: vi.fn(),
  markContentCachePrefixStale: vi.fn(),
  storage: new Map<string, string>(),
}));

vi.mock("@/lib/firebase", () => ({
  auth: { currentUser: { uid: "admin-uid" } },
}));

vi.mock("@/lib/browser-storage", () => ({
  readLocalStorage: (key: string) => mocks.storage.get(key) ?? null,
  writeLocalStorage: (key: string, value: string) => mocks.storage.set(key, value),
}));

vi.mock("@/services/content-read-cache", () => ({
  markContentCachePrefixStale: mocks.markContentCachePrefixStale,
}));

vi.mock("@/lib/content-entity-store", () => ({
  clearContentEntityDomain: mocks.clearContentEntityDomain,
}));

import { applyContentVersionsSnapshot } from "@/services/content-versions";

const storageKey = "novae:content-versions:admin-uid";

describe("content version reconciliation", () => {
  beforeEach(() => {
    mocks.clearContentEntityDomain.mockClear();
    mocks.markContentCachePrefixStale.mockClear();
    mocks.storage.clear();
  });

  it("invalidates cached content when the authoritative version decreases after reset", () => {
    mocks.storage.set(storageKey, JSON.stringify({
      versions: { announcements: 31, facilities: 19, issues: 47 },
    }));

    const changed = applyContentVersionsSnapshot({
      announcements: 31,
      facilities: 19,
      issues: 2,
    });

    expect(changed).toEqual(["issues"]);
    expect(mocks.clearContentEntityDomain).toHaveBeenCalledWith("admin-uid", "issue");
    expect(JSON.parse(mocks.storage.get(storageKey) ?? "{}").versions.issues).toBe(2);
  });

  it("keeps caches only when local and authoritative versions are equal", () => {
    const versions = { announcements: 31, facilities: 19, issues: 47 };
    mocks.storage.set(storageKey, JSON.stringify({ versions }));

    expect(applyContentVersionsSnapshot(versions)).toEqual([]);
    expect(mocks.markContentCachePrefixStale).not.toHaveBeenCalled();
    expect(mocks.clearContentEntityDomain).not.toHaveBeenCalled();
  });
});
