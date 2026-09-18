import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

async function source(name: string) {
  return await readFile(resolve("tests/e2e", name), "utf8");
}

describe("E2E permission and operation coverage", () => {
  it("executes every user-facing content mutation family", async () => {
    const text = `${await source("operation-behavior.spec.ts")}\n${await source("pages/content-pages.ts")}`;
    for (const action of [
      "createIssue",
      "toggleSupport",
      "removeSupport",
      "createComment",
      "deleteComment",
      "moderateIssueStatus",
      "updateIssueResult",
      "deleteIssue",
      "createFacility",
      "toggleFacilityAffected",
      "updateFacilityStatus",
      "deleteFacility",
      "createAnnouncement",
      "setAnnouncementLike",
      "createAnnouncementComment",
      "deleteAnnouncementComment",
      "deleteAnnouncement",
      "markAnnouncementsOpened",
    ]) {
      expect(text, `missing E2E operation ${action}`).toContain(action);
    }
  });

  it("covers ordinary, owner, scoped-manager, cross-scope, and platform-admin visibility", async () => {
    const text = await source("access-visibility.spec.ts");
    for (const principal of [
      "ordinary",
      "other",
      "issueManager",
      "facilityManager",
      "announcementManager",
      "admin",
    ]) {
      expect(text, `missing E2E principal ${principal}`).toContain(principal);
    }
    for (const control of [
      "Manage status",
      "Delete proposal",
      "Update status",
      "Delete report",
      "Delete announcement",
    ]) {
      expect(text, `missing permission control ${control}`).toContain(control);
    }
  });

  it("covers independent scope grant and revocation without collateral access loss", async () => {
    const text = await source("scope-revocation.spec.ts");
    for (const scope of ["Proposal A", "Proposal B", "Facility A", "announcement"]) {
      expect(text, `missing scope transition ${scope}`).toContain(scope);
    }
    expect(text.match(/false,/gu)?.length ?? 0).toBeGreaterThanOrEqual(4);
  });

  it("covers administrative writes and every feature-switch combination", async () => {
    const administration = await source("admin-and-account-operations.spec.ts");
    for (const action of [
      "saveAccountAccessRule",
      "deleteAccountAccessRule",
      "savePlatformSettings",
      "saveOperationPolicies",
      "updatePlatformAdminNotificationPreferences",
      "retryOperationalWork",
    ]) {
      expect(administration, `missing administrative E2E operation ${action}`).toContain(action);
    }
    const features = await source("feature-switches.spec.ts");
    expect(features.match(/facilities: (?:true|false), issues: (?:true|false)/gu)).toHaveLength(4);
  });
});
