import assert from "node:assert/strict";
import {
  asRecord,
  callAction,
  expectActionError,
  insertReadyUpload,
  integrationTest,
  refreshActor,
  requestId,
  saveCategoryDraft,
  seedActor,
  database,
  tableRow,
} from "../helpers.ts";

integrationTest("runtime category setup and management enforce platform permissions and immutable privacy", async () => {
  const admin = await seedActor("category-admin", { roles: ["platform-admin"] });
  const user = await seedActor("category-user");

  const catalog = asRecord(await callAction("getCategoryCatalog", {}, user.auth));
  assert.ok((catalog.issueCategories as unknown[]).length >= 2);
  assert.ok((catalog.facilityCategories as unknown[]).length >= 1);
  assert.deepEqual(asRecord(catalog.features), {
    announcementCommentsEnabled: true,
    facilitiesEnabled: true,
    issuesEnabled: true,
  });
  await expectActionError("permission-denied", () => callAction("getCategoryManagement", {}, user.auth));
  await expectActionError("permission-denied", () => callAction("completeInitialSetup", {
    facilitiesEnabled: false, facilityCategories: [], issuesEnabled: false,
    issueCategories: [], requestId: requestId("setup-denied"),
  }, user.auth));
  await expectActionError("permission-denied", () => callAction("savePlatformFeatures", {
    announcementCommentsEnabled: true,
    facilitiesEnabled: false, issuesEnabled: false, requestId: requestId("features-denied"),
  }, user.auth));

  const setup = asRecord(await callAction("completeInitialSetup", {
    issueCategories: [
      {
        id: "public-issues", label: "公共議題", readAccess: "reviewed-school",
        authorVisible: false, supportEnabled: true, supportGoal: 50, supportDeadlineDays: 14,
        responseDeadlineDays: 7, commentsEnabled: true,
      },
      {
        id: "rights-maintenance", label: "學生權益", readAccess: "owner-admin",
        authorVisible: true, supportEnabled: false, supportGoal: null, supportDeadlineDays: null,
        responseDeadlineDays: 7, commentsEnabled: true,
      },
    ],
    facilitiesEnabled: false,
    facilityCategories: [],
    issuesEnabled: true,
    requestId: requestId("complete-setup"),
  }, admin.auth));
  assert.equal(setup.success, true);
  assert.equal(setup.facilitiesEnabled, false);
  const repeatedSetup = asRecord(await callAction("completeInitialSetup", {
    issueCategories: [],
    facilityCategories: [],
    requestId: requestId("complete-setup-repeat"),
  }, admin.auth));
  assert.equal(repeatedSetup.success, true);
  assert.equal(repeatedSetup.setupCompleted, true);

  const management = asRecord(await callAction("getCategoryManagement", {}, admin.auth));
  assert.deepEqual(asRecord(management.features), {
    announcementCommentsEnabled: true,
    facilitiesEnabled: false,
    issuesEnabled: true,
  });
  const publicCategory = asRecord((management.issueCategories as unknown[])
    .find((value) => asRecord(value).id === "public-issues"));
  const savedIssue = asRecord(await saveCategoryDraft(admin.auth, {
    upsertIssueCategories: [{ ...publicCategory, label: "公共議題-修改" }],
  }));
  assert.equal(
    asRecord((savedIssue.issueCategories as unknown[])
      .find((value) => asRecord(value).id === "public-issues")).label,
    "公共議題-修改",
  );
  await expectActionError("immutable-category-policy", () => saveCategoryDraft(admin.auth, {
    upsertIssueCategories: [{ ...publicCategory, readAccess: "school" }],
  }));
  await expectActionError("permission-denied", () => callAction("saveCategoryManagement", {
    announcementCommentsEnabled: true,
    deletedFacilityCategoryIds: [],
    deletedIssueCategoryIds: [],
    facilitiesEnabled: false,
    facilityCategories: [],
    issueCategories: [publicCategory],
    issuesEnabled: true,
    requestId: requestId("save-category-denied"),
  }, user.auth));

  const savedFacility = asRecord(await saveCategoryDraft(admin.auth, {
    facilitiesEnabled: true,
    upsertFacilityCategories: [{
      id: "general", isDefault: true, label: "一般設備-修改", sortOrder: 0,
    }],
  }));
  assert.equal(
    asRecord((savedFacility.facilityCategories as unknown[])
      .find((value) => asRecord(value).id === "general")).label,
    "一般設備-修改",
  );
  const updatedCatalog = asRecord(await callAction("getCategoryCatalog", {}, user.auth));
  assert.deepEqual(asRecord(updatedCatalog.features), {
    announcementCommentsEnabled: true,
    facilitiesEnabled: true,
    issuesEnabled: true,
  });

  const managed = asRecord(await callAction("getCategoryManagement", {}, admin.auth));
  const managedIssues = (managed.issueCategories as unknown[]).map((value, index) => {
    const category = asRecord(value);
    return {
      ...category,
      label: category.id === "public-issues" ? "公共議題-原子" : category.label,
      sortOrder: index,
    };
  });
  const managedFacilities = (managed.facilityCategories as unknown[]).map((value, index) => {
    const category = asRecord(value);
    return {
      ...category,
      label: category.id === "general" ? "一般設備-原子" : category.label,
      sortOrder: index,
    };
  });
  await expectActionError("permission-denied", () => callAction("saveCategoryManagement", {
    announcementCommentsEnabled: true,
    deletedFacilityCategoryIds: [],
    deletedIssueCategoryIds: [],
    facilitiesEnabled: true,
    facilityCategories: managedFacilities,
    issueCategories: managedIssues,
    issuesEnabled: true,
    requestId: requestId("save-management-denied"),
  }, user.auth));
  await expectActionError("validation-required", () => callAction("saveCategoryManagement", {
    announcementCommentsEnabled: true,
    deletedFacilityCategoryIds: [],
    deletedIssueCategoryIds: [],
    facilitiesEnabled: true,
    facilityCategories: [],
    issueCategories: managedIssues,
    issuesEnabled: true,
    requestId: requestId("save-management-empty"),
  }, admin.auth));
  const atomicSave = asRecord(await callAction("saveCategoryManagement", {
    announcementCommentsEnabled: false,
    deletedFacilityCategoryIds: [],
    deletedIssueCategoryIds: [],
    facilitiesEnabled: true,
    facilityCategories: managedFacilities,
    issueCategories: managedIssues,
    issuesEnabled: true,
    requestId: requestId("save-management-ok"),
  }, admin.auth));
  assert.equal(atomicSave.success, true);
  assert.deepEqual(asRecord(atomicSave.features), {
    announcementCommentsEnabled: false,
    facilitiesEnabled: true,
    issuesEnabled: true,
  });
  assert.equal(
    asRecord((atomicSave.issueCategories as unknown[])
      .find((value) => asRecord(value).id === "public-issues")).label,
    "公共議題-原子",
  );
  assert.equal(
    asRecord((atomicSave.facilityCategories as unknown[])
      .find((value) => asRecord(value).id === "general")).label,
    "一般設備-原子",
  );
  const catalogAfterAtomic = asRecord(await callAction("getCategoryCatalog", {}, user.auth));
  assert.equal(
    asRecord((catalogAfterAtomic.issueCategories as unknown[])
      .find((value) => asRecord(value).id === "public-issues")).label,
    "公共議題-原子",
  );
  await saveCategoryDraft(admin.auth, { announcementCommentsEnabled: true });
});
