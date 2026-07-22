import assert from "node:assert/strict";
import {
  asRecord,
  callAction,
  expectActionError,
  insertReadyUpload,
  integrationTest,
  refreshActor,
  requestId,
  seedActor,
  supabase,
} from "./helpers.ts";

type Actor = Awaited<ReturnType<typeof seedActor>>;
type RecordValue = Record<string, unknown>;

const stressScale = Math.min(20, Math.max(2, Number(Deno.env.get("NOVAE_STRESS_SCALE") ?? 4)));
const runId = crypto.randomUUID().slice(0, 8);

function records(value: unknown) {
  assert.ok(Array.isArray(value));
  return value.map(asRecord);
}

function markdownWithUpload(id: string, label: string) {
  return `${label}\n\n![${label}](srp-upload://${id})`;
}

async function configureAccess(
  admin: Actor,
  actor: Actor,
  issueCategoryIds: string[],
  facilityCategoryIds: string[],
  roles: string[] = [],
) {
  const desiredIssueIds = new Set(issueCategoryIds);
  const desiredFacilityIds = new Set(facilityCategoryIds);
  const currentIssueIds = new Set(actor.auth.managedIssueCategoryIds);
  const currentFacilityIds = new Set(actor.auth.managedFacilityCategoryIds);
  const operations = [
    {
      categoryId: undefined,
      grant: roles.includes("announcement-manager"),
      scopeKind: "announcement",
      shouldRun: roles.includes("announcement-manager") !== actor.auth.roles.includes("announcement-manager"),
    },
    ...Array.from(new Set([...currentIssueIds, ...desiredIssueIds]), (categoryId) => ({
      categoryId,
      grant: desiredIssueIds.has(categoryId),
      scopeKind: "issue",
      shouldRun: desiredIssueIds.has(categoryId) !== currentIssueIds.has(categoryId),
    })),
    ...Array.from(new Set([...currentFacilityIds, ...desiredFacilityIds]), (categoryId) => ({
      categoryId,
      grant: desiredFacilityIds.has(categoryId),
      scopeKind: "facility",
      shouldRun: desiredFacilityIds.has(categoryId) !== currentFacilityIds.has(categoryId),
    })),
  ].filter((operation) => operation.shouldRun);
  const results = await Promise.all(operations.map((operation) => callAction("setUserAccessScope", {
    categoryId: operation.categoryId,
    grant: operation.grant,
    requestId: requestId(`stress-access-${operation.scopeKind}`),
    scopeKind: operation.scopeKind,
    uid: actor.auth.uid,
  }, admin.auth)));
  for (const result of results) assert.equal(asRecord(result).success, true);
  return await refreshActor(actor);
}

async function exerciseNotifications(actor: Actor, index: number) {
  const deviceId = `stress-${runId}-${index}`;
  const registered = asRecord(await callAction("registerPushToken", {
    deviceId,
    permission: "granted",
    platform: "stress",
    token: `stress-token-${runId}-${index}`,
    userAgent: "Novae integration stress test",
  }, actor.auth));
  assert.equal(registered.deviceEnabled, true);
  const preference = asRecord(await callAction("updatePushNotificationPreferences", {
    deviceId,
    permission: "granted",
    preferences: {
      comments: index % 2 === 0,
      facilityUpdates: index % 3 === 0,
      issueUpdates: index % 4 !== 0,
    },
  }, actor.auth));
  assert.equal(typeof asRecord(preference.personalPreferences).comments, "boolean");
  assert.equal(asRecord(await callAction("markNotificationsOpened", {}, actor.auth)).success, true);
  const unregistered = asRecord(await callAction("unregisterPushToken", {
    deviceId,
    permission: index % 2 === 0 ? "default" : "denied",
  }, actor.auth));
  assert.equal(unregistered.deviceEnabled, false);
}

integrationTest(`dynamic full workflow stress matrix (scale ${stressScale})`, async () => {
  const admins = await Promise.all([
    seedActor(`stress-admin-a-${runId}`, { roles: ["platform-admin"] }),
    seedActor(`stress-admin-b-${runId}`, { roles: ["platform-admin"] }),
  ]);
  const ordinaryUsers = await Promise.all(
    Array.from({ length: stressScale * 2 }, (_, index) => seedActor(`stress-user-${runId}-${index}`)),
  );
  const rawManagers = await Promise.all(
    Array.from({ length: stressScale }, (_, index) => seedActor(`stress-manager-${runId}-${index}`)),
  );

  const issueCategoryId = `stress-issue-${runId}`;
  const facilityCategoryId = `stress-facility-${runId}`;
  await callAction("saveIssueCategory", {
    category: {
      authorVisible: true,
      commentsEnabled: true,
      id: issueCategoryId,
      isActive: true,
      isDefault: false,
      label: `壓測提案 ${runId}`,
      readAccess: "school",
      responseDeadlineDays: 7,
      sortOrder: 10_000,
      supportDeadlineDays: 14,
      supportEnabled: true,
      supportGoal: stressScale,
    },
    requestId: requestId("stress-create-issue-category"),
  }, admins[0].auth);
  await callAction("saveFacilityCategory", {
    category: {
      id: facilityCategoryId,
      isActive: true,
      isDefault: false,
      label: `壓測設備 ${runId}`,
      sortOrder: 10_000,
    },
    requestId: requestId("stress-create-facility-category"),
  }, admins[1].auth);

  const management = asRecord(await callAction("getCategoryManagement", {}, admins[0].auth));
  const issueCategories = records(management.issueCategories).filter((category) => category.isActive !== false);
  const facilityCategories = records(management.facilityCategories).filter((category) => category.isActive !== false);
  const issueIds = issueCategories.map((category) => String(category.id));
  const facilityIds = facilityCategories.map((category) => String(category.id));
  assert.ok(issueIds.includes(issueCategoryId));
  assert.ok(facilityIds.includes(facilityCategoryId));

  const managers = await Promise.all(rawManagers.map((manager, index) => configureAccess(
    admins[index % admins.length],
    manager,
    issueIds,
    facilityIds,
    index % 2 === 0 ? ["announcement-manager"] : [],
  )));
  for (const manager of managers) {
    assert.deepEqual(new Set(manager.auth.managedIssueCategoryIds), new Set(issueIds));
    assert.deepEqual(new Set(manager.auth.managedFacilityCategoryIds), new Set(facilityIds));
  }
  const announcementManagers = managers.filter((manager) => manager.auth.permissions.includes("announcement.manage"));
  assert.ok(announcementManagers.length >= 1);

  const lookedUpOrdinaryUser = asRecord(await callAction("listRoleAssignments", {
    query: ordinaryUsers[0].auth.uid,
  }, admins[0].auth));
  assert.equal(records(lookedUpOrdinaryUser.users).length, 1);
  assert.equal(String(records(lookedUpOrdinaryUser.users)[0].uid), ordinaryUsers[0].auth.uid);

  for (const categoryId of issueIds) {
    const result = asRecord(await callAction("listRoleAssignments", {
      categoryId, query: "", scopeKind: "issue",
    }, admins[0].auth));
    const assignedUids = new Set(records(result.users).map((row) => String(row.uid)));
    for (const manager of managers) assert.ok(assignedUids.has(manager.auth.uid));
  }
  for (const categoryId of facilityIds) {
    const result = asRecord(await callAction("listRoleAssignments", {
      categoryId, query: "", scopeKind: "facility",
    }, admins[1].auth));
    const assignedUids = new Set(records(result.users).map((row) => String(row.uid)));
    for (const manager of managers) assert.ok(assignedUids.has(manager.auth.uid));
  }
  const announcementAssignmentResult = asRecord(await callAction("listRoleAssignments", {
    query: "", scopeKind: "announcement",
  }, admins[0].auth));
  const announcementAssignmentUids = new Set(records(announcementAssignmentResult.users).map((row) => String(row.uid)));
  for (const manager of announcementManagers) assert.ok(announcementAssignmentUids.has(manager.auth.uid));

  const firstManagerRoles = managers[0].auth.roles.filter((role) => role !== "platform-admin");
  managers[0] = await configureAccess(admins[0], managers[0], issueIds.slice(1), facilityIds, firstManagerRoles);
  const revokedList = asRecord(await callAction("listRoleAssignments", {
    categoryId: issueIds[0], query: "", scopeKind: "issue",
  }, admins[0].auth));
  assert.ok(!records(revokedList.users).some((row) => row.uid === managers[0].auth.uid));
  managers[0] = await configureAccess(admins[0], managers[0], issueIds, facilityIds, firstManagerRoles);

  const issueRows = await Promise.all(issueCategories.flatMap((category, categoryIndex) =>
    Array.from({ length: stressScale }, async (_, itemIndex) => {
      const owner = ordinaryUsers[(categoryIndex * stressScale + itemIndex) % ordinaryUsers.length];
      const upload = await insertReadyUpload(owner.auth.uid, `issue-${runId}-${categoryIndex}-${itemIndex}`);
      const created = asRecord(await callAction("createIssue", {
        category: String(category.id),
        content: markdownWithUpload(upload.id, `Stress issue ${categoryIndex}-${itemIndex}`),
        requestId: requestId("stress-create-issue"),
        title: `Stress ${categoryIndex}-${itemIndex}`,
      }, owner.auth));
      return { category, issue: asRecord(created.issue), owner };
    })
  ));
  assert.equal(issueRows.length, issueCategories.length * stressScale);

  for (let index = 0; index < issueRows.length; index += 1) {
    const { category, issue, owner } = issueRows[index];
    const issueId = String(issue.id);
    const managerA = managers[index % managers.length];
    const managerB = managers[(index + 1) % managers.length];
    if (issue.status === "under-review") {
      const approved = asRecord(await callAction("moderateIssueStatus", {
        issueId,
        requestId: requestId("stress-review"),
        status: "pending",
      }, managerA.auth));
      assert.equal(asRecord(approved.issue).status, "pending");
    }
    if (issue.comments_enabled === false) {
      await callAction("setIssueCommentsEnabled", {
        enabled: true,
        issueId,
        requestId: requestId("stress-enable-comments"),
      }, managerA.auth);
    }
    const root = asRecord(await callAction("createComment", {
      content: `Stress root ${index}`,
      issueId,
      requestId: requestId("stress-root-comment"),
    }, owner.auth));
    const rootId = String(asRecord(root.comment).id);
    const reply = asRecord(await callAction("createComment", {
      content: `Stress nested reply ${index}`,
      issueId,
      parentCommentId: rootId,
      requestId: requestId("stress-nested-comment"),
    }, managerB.auth));
    assert.equal(asRecord(reply.comment).parent_comment_id, rootId);
    const comments = asRecord(await callAction("listComments", { issueId, pageSize: 30 }, managerA.auth));
    assert.ok(JSON.stringify(comments).includes(rootId));
    const result = asRecord(await callAction("updateIssueResult", {
      issueId,
      requestId: requestId("stress-issue-result"),
      resultContent: `Handled by multiple managers ${runId}`,
    }, managerB.auth));
    assert.equal(asRecord(result.issue).result_content, `Handled by multiple managers ${runId}`);
    if (category.supportEnabled === true && category.readAccess !== "owner-admin") {
      const supporter = ordinaryUsers[(index + 1) % ordinaryUsers.length];
      if (supporter.auth.uid !== owner.auth.uid) {
        const supported = asRecord(await callAction("toggleSupport", {
          issueId,
          requestId: requestId("stress-support"),
        }, supporter.auth));
        assert.equal(supported.supported, true);
      }
    }
  }

  const facilityRows = await Promise.all(facilityCategories.flatMap((category, categoryIndex) =>
    Array.from({ length: stressScale }, async (_, itemIndex) => {
      const owner = ordinaryUsers[(categoryIndex + itemIndex) % ordinaryUsers.length];
      const upload = await insertReadyUpload(owner.auth.uid, `facility-${runId}-${categoryIndex}-${itemIndex}`);
      const created = asRecord(await callAction("createFacility", {
        categoryId: String(category.id),
        content: markdownWithUpload(upload.id, `Stress facility ${categoryIndex}-${itemIndex}`),
        location: `Stress room ${categoryIndex}-${itemIndex}`,
        requestId: requestId("stress-create-facility"),
        title: `Facility ${categoryIndex}-${itemIndex}`,
      }, owner.auth));
      return { facility: asRecord(created.facility), owner };
    })
  ));
  for (let index = 0; index < facilityRows.length; index += 1) {
    const facilityId = String(facilityRows[index].facility.id);
    const affectedUser = ordinaryUsers.find((user) => user.auth.uid !== facilityRows[index].owner.auth.uid);
    assert.ok(affectedUser);
    const affected = asRecord(await callAction("toggleFacilityAffected", {
      facilityId,
      requestId: requestId("stress-facility-affected"),
    }, affectedUser.auth));
    assert.equal(affected.affected, true);
    const updated = asRecord(await callAction("updateFacilityStatus", {
      facilityId,
      requestId: requestId("stress-facility-status"),
      status: "processing",
    }, managers[index % managers.length].auth));
    assert.equal(asRecord(updated.facility).status, "processing");
  }

  const announcements = await Promise.all(announcementManagers.map(async (manager, index) => {
    const upload = await insertReadyUpload(manager.auth.uid, `announcement-${runId}-${index}`);
    const created = asRecord(await callAction("createAnnouncement", {
      content: markdownWithUpload(upload.id, `Stress announcement ${index}`),
      requestId: requestId("stress-announcement"),
      title: `Stress announcement ${index}`,
    }, manager.auth));
    return asRecord(created.announcement);
  }));
  for (let index = 0; index < announcements.length; index += 1) {
    const announcementId = String(announcements[index].id);
    const user = ordinaryUsers[index % ordinaryUsers.length];
    assert.equal(asRecord(await callAction("setAnnouncementLike", {
      announcementId, liked: true, requestId: requestId("stress-like"),
    }, user.auth)).liked, true);
    const root = asRecord(await callAction("createAnnouncementComment", {
      announcementId, content: `Announcement root ${index}`, requestId: requestId("stress-announcement-root"),
    }, user.auth));
    const rootId = String(asRecord(root.comment).id);
    const nested = asRecord(await callAction("createAnnouncementComment", {
      announcementId,
      content: `Announcement nested ${index}`,
      parentCommentId: rootId,
      requestId: requestId("stress-announcement-nested"),
    }, ordinaryUsers[(index + 1) % ordinaryUsers.length].auth));
    assert.equal(asRecord(nested.comment).parent_comment_id, rootId);
  }

  await Promise.all(ordinaryUsers.map(exerciseNotifications));
  await expectActionError("permission-denied", () => callAction("createAnnouncement", {
    content: "Denied under stress",
    requestId: requestId("stress-denied-announcement"),
    title: "Denied",
  }, ordinaryUsers[0].auth));

  const scoped = await configureAccess(admins[0], await seedActor(`stress-scoped-${runId}`), [issueIds[0]], [], []);
  if (issueIds.length > 1) {
    const outside = issueRows.find((row) => row.category.id === issueIds[1]);
    assert.ok(outside);
    await expectActionError("permission-denied", () => callAction("moderateIssueStatus", {
      issueId: String(outside.issue.id),
      requestId: requestId("stress-cross-scope-denied"),
      status: "processing",
    }, scoped.auth));
  }

  for (const issuesEnabled of [true, false]) {
    for (const facilitiesEnabled of [true, false]) {
      const saved = asRecord(await callAction("savePlatformFeatures", {
        facilitiesEnabled,
        issuesEnabled,
        requestId: requestId("stress-platform-features"),
      }, admins[0].auth));
      assert.equal(saved.issuesEnabled, issuesEnabled);
      assert.equal(saved.facilitiesEnabled, facilitiesEnabled);
      const featureCatalog = asRecord(await callAction("getCategoryCatalog", {}, ordinaryUsers[0].auth));
      assert.deepEqual(asRecord(featureCatalog.features), { facilitiesEnabled, issuesEnabled });
    }
  }

  await callAction("deleteCategory", {
    id: issueCategoryId, kind: "issue", requestId: requestId("stress-delete-issue-category"),
  }, admins[0].auth);
  await callAction("deleteCategory", {
    id: facilityCategoryId, kind: "facility", requestId: requestId("stress-delete-facility-category"),
  }, admins[1].auth);
  const [issueCategoryRow, facilityCategoryRow] = await Promise.all([
    supabase.schema("app_private").from("issue_categories").select("id").eq("id", issueCategoryId).maybeSingle(),
    supabase.schema("app_private").from("facility_categories").select("id").eq("id", facilityCategoryId).maybeSingle(),
  ]);
  if (issueCategoryRow.error) throw issueCategoryRow.error;
  if (facilityCategoryRow.error) throw facilityCategoryRow.error;
  assert.equal(issueCategoryRow.data, null);
  assert.equal(facilityCategoryRow.data, null);
});
