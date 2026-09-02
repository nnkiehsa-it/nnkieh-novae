import assert from "node:assert/strict";
import {
  asRecord,
  callAction,
  expectActionError,
  insertReadyUpload,
  integrationTest,
  refreshActor,
  saveCategoryDraft,
  seedActor,
  database,
  tableRow,
} from "../helpers.ts";

integrationTest("revoking each access scope immediately removes its reads, writes, and assignment listing", async () => {
  const admin = await seedActor("revocation-admin", { roles: ["platform-admin"] });
  const owner = await seedActor("revocation-owner");
  let target = await seedActor("revocation-target");
  const catalog = asRecord(await callAction("getCategoryCatalog", {}, owner.auth));
  const issueCategory = asRecord((catalog.issueCategories as unknown[])
    .find((value) => asRecord(value).id === "public-issues"));
  const facilityCategory = asRecord((catalog.facilityCategories as unknown[])
    .find((value) => asRecord(value).isDefault === true)
    ?? (catalog.facilityCategories as unknown[])[0]);
  const issueCategoryId = String(issueCategory.id);
  const facilityCategoryId = String(facilityCategory.id);

  for (const scope of [
    { categoryId: issueCategoryId, scopeKind: "issue" },
    { categoryId: facilityCategoryId, scopeKind: "facility" },
    { scopeKind: "announcement" },
  ]) {
    await callAction("setUserAccessScope", {
      ...scope,
      grant: true,
      uid: target.auth.uid,
    }, admin.auth);
  }
  target = await refreshActor(target);
  assert.ok(target.auth.permissions.includes("proposal.manage"));
  assert.ok(!target.auth.permissions.includes("facility.manage"));
  assert.deepEqual(target.auth.managedFacilityCategoryIds, [facilityCategoryId]);
  assert.ok(target.auth.permissions.includes("announcement.manage"));

  const issue = asRecord(asRecord(await callAction("createIssue", {
    category: issueCategoryId,
    content: "Revocation issue content",
    title: "Revocation issue",
  }, owner.auth)).issue);
  const facility = asRecord(asRecord(await callAction("createFacility", {
    categoryId: facilityCategoryId,
    content: "Revocation facility content",
    location: "Revocation room",
    title: "Revocation facility",
  }, owner.auth)).facility);
  const announcement = asRecord(asRecord(await callAction("createAnnouncement", {
    content: "Revocation announcement content",
    title: "Revocation announcement",
  }, target.auth)).announcement);

  assert.equal(
    asRecord(asRecord(await callAction("getIssue", {
      issueId: String(issue.id),
    }, target.auth)).issue).id,
    issue.id,
  );
  assert.equal(
    asRecord(asRecord(await callAction("getFacility", {
      facilityId: String(facility.id),
    }, target.auth)).facility).canManageFacility,
    true,
  );

  await callAction("setUserAccessScope", {
    categoryId: issueCategoryId,
    grant: false,
    scopeKind: "issue",
    uid: target.auth.uid,
  }, admin.auth);
  target = await refreshActor(target);
  assert.ok(!target.auth.permissions.includes("proposal.manage"));
  assert.deepEqual(target.auth.managedIssueCategoryIds, []);
  assert.deepEqual(target.auth.managedFacilityCategoryIds, [facilityCategoryId]);
  assert.ok(target.auth.permissions.includes("announcement.manage"));
  await expectActionError("not-found", () => callAction("getIssue", {
    issueId: String(issue.id),
  }, target.auth));
  await expectActionError("permission-denied", () => callAction("moderateIssueStatus", {
    issueId: String(issue.id),
    status: "pending",
  }, target.auth));
  const issueAssignees = asRecord(await callAction("listRoleAssignments", {
    categoryId: issueCategoryId,
    query: "",
    scopeKind: "issue",
  }, admin.auth));
  assert.ok(!(issueAssignees.users as Array<{ uid: string }>)
    .some((user) => user.uid === target.auth.uid));

  await callAction("setUserAccessScope", {
    categoryId: facilityCategoryId,
    grant: false,
    scopeKind: "facility",
    uid: target.auth.uid,
  }, admin.auth);
  target = await refreshActor(target);
  assert.ok(!target.auth.permissions.includes("facility.manage"));
  assert.deepEqual(target.auth.managedFacilityCategoryIds, []);
  assert.ok(target.auth.permissions.includes("announcement.manage"));
  await expectActionError("permission-denied", () => callAction("updateFacilityStatus", {
    facilityId: String(facility.id),
    status: "processing",
  }, target.auth));
  const facilityAssignees = asRecord(await callAction("listRoleAssignments", {
    categoryId: facilityCategoryId,
    query: "",
    scopeKind: "facility",
  }, admin.auth));
  assert.ok(!(facilityAssignees.users as Array<{ uid: string }>)
    .some((user) => user.uid === target.auth.uid));

  await callAction("setUserAccessScope", {
    grant: false,
    scopeKind: "announcement",
    uid: target.auth.uid,
  }, admin.auth);
  target = await refreshActor(target);
  assert.ok(!target.auth.permissions.includes("announcement.manage"));
  assert.deepEqual(target.auth.permissions, []);
  await expectActionError("permission-denied", () => callAction("createAnnouncement", {
    content: "Must not publish after revocation",
    title: "Denied after revocation",
  }, target.auth));
  await expectActionError("permission-denied", () => callAction("deleteAnnouncement", {
    announcementId: String(announcement.id),
  }, target.auth));
  const announcementAssignees = asRecord(await callAction("listRoleAssignments", {
    query: "",
    scopeKind: "announcement",
  }, admin.auth));
  assert.ok(!(announcementAssignees.users as Array<{ uid: string }>)
    .some((user) => user.uid === target.auth.uid));
});
