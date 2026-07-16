import assert from "node:assert/strict";
import {
  asRecord,
  callAction,
  expectActionError,
  integrationTest,
  requestId,
  seedActor,
} from "./helpers.ts";

async function createIssue(
  actor: Awaited<ReturnType<typeof seedActor>>,
  category: "public-issues" | "rights-maintenance",
  label: string,
) {
  const result = asRecord(await callAction("createIssue", {
    category,
    content: `Integration content ${label}`,
    requestId: requestId(`create-issue-${label}`),
    title: `Test ${label}`.slice(0, 30),
  }, actor.auth));
  return asRecord(result.issue);
}

integrationTest("issue reads, scoped moderation, support, comments, and deletion", async () => {
  const admin = await seedActor("issue-admin", { roles: ["platform-admin"] });
  const owner = await seedActor("issue-owner");
  const user = await seedActor("issue-user");
  const stranger = await seedActor("issue-stranger");
  const publicManager = await seedActor("issue-public-manager", {
    categoryIds: ["public-issues"],
  });
  const rightsManager = await seedActor("issue-rights-manager", {
    categoryIds: ["rights-maintenance"],
  });

  assert.ok(publicManager.auth.permissions.includes("proposal.manage"));
  assert.deepEqual(publicManager.auth.managedIssueCategoryIds, ["public-issues"]);

  const publicIssue = await createIssue(owner, "public-issues", "public");
  const publicIssueId = String(publicIssue.id);
  assert.equal(publicIssue.status, "under-review");

  const ownerRead = asRecord(await callAction(
    "getIssue",
    { issueId: publicIssueId },
    owner.auth,
  ));
  assert.equal(asRecord(ownerRead.issue).id, publicIssueId);
  await expectActionError(
    "not-found",
    () => callAction("getIssue", { issueId: publicIssueId }, user.auth),
  );

  const hiddenList = asRecord(await callAction("listIssues", {
    activeFilter: "public-issues",
    pageSize: 20,
    sort: "latest",
    statusBucket: "active",
  }, user.auth));
  assert.equal((hiddenList.issues as unknown[]).length, 0);
  const managerList = asRecord(await callAction("listIssues", {
    activeFilter: "public-issues",
    pageSize: 20,
    sort: "latest",
    statusBucket: "active",
  }, publicManager.auth));
  assert.ok((managerList.issues as JsonRecord[]).some((issue) => issue.id === publicIssueId));
  const searched = asRecord(await callAction("searchIssues", {
    activeFilter: "public-issues",
    pageSize: 20,
    sort: "latest",
    statusBucket: "active",
    titleQuery: "public",
  }, publicManager.auth));
  assert.ok((searched.issues as JsonRecord[]).some((issue) => issue.id === publicIssueId));
  const ownIssues = asRecord(await callAction("listUserIssues", {
    pageSize: 20,
    sort: "latest",
    statusBucket: "active",
  }, owner.auth));
  assert.ok((ownIssues.issues as JsonRecord[]).some((issue) => issue.id === publicIssueId));

  await expectActionError(
    "permission-denied",
    () => callAction("moderateIssueStatus", {
      issueId: publicIssueId,
      requestId: requestId("regular-moderate"),
      status: "pending",
    }, user.auth),
  );
  await expectActionError(
    "permission-denied",
    () => callAction("moderateIssueStatus", {
      issueId: publicIssueId,
      requestId: requestId("wrong-scope-moderate"),
      status: "pending",
    }, rightsManager.auth),
  );
  const approved = asRecord(await callAction("moderateIssueStatus", {
    issueId: publicIssueId,
    requestId: requestId("approve"),
    status: "pending",
  }, publicManager.auth));
  assert.equal(asRecord(approved.issue).status, "pending");

  await expectActionError(
    "permission-denied",
    () => callAction("updateIssueResult", {
      issueId: publicIssueId,
      requestId: requestId("regular-result"),
      resultContent: "Not allowed",
    }, user.auth),
  );
  const resultWrite = asRecord(await callAction("updateIssueResult", {
    issueId: publicIssueId,
    requestId: requestId("manager-result"),
    resultContent: "Integration result",
  }, publicManager.auth));
  assert.equal(asRecord(resultWrite.issue).result_content, "Integration result");

  await expectActionError(
    "support-not-available",
    () => callAction("toggleSupport", {
      issueId: publicIssueId,
      requestId: requestId("self-support"),
    }, owner.auth),
  );
  const supported = asRecord(await callAction("toggleSupport", {
    issueId: publicIssueId,
    requestId: requestId("support"),
  }, user.auth));
  assert.equal(supported.supported, true);
  const removed = asRecord(await callAction("removeSupport", {
    issueId: publicIssueId,
    requestId: requestId("remove-support"),
  }, user.auth));
  assert.equal(removed.supported, false);

  const commentWrite = asRecord(await callAction("createComment", {
    content: "Integration issue comment",
    issueId: publicIssueId,
    requestId: requestId("comment"),
  }, user.auth));
  const commentId = String(asRecord(commentWrite.comment).id);
  const comments = asRecord(await callAction("listComments", {
    issueId: publicIssueId,
    pageSize: 30,
  }, stranger.auth));
  assert.ok(JSON.stringify(comments).includes(commentId));
  await expectActionError(
    "permission-denied",
    () => callAction("deleteComment", {
      commentId,
      requestId: requestId("stranger-delete-comment"),
    }, stranger.auth),
  );
  await callAction("deleteComment", {
    commentId,
    requestId: requestId("owner-delete-comment"),
  }, user.auth);

  const managedCommentWrite = asRecord(await callAction("createComment", {
    content: "Manager removable comment",
    issueId: publicIssueId,
    requestId: requestId("managed-comment"),
  }, stranger.auth));
  await callAction("deleteComment", {
    commentId: String(asRecord(managedCommentWrite.comment).id),
    requestId: requestId("manager-delete-comment"),
  }, publicManager.auth);

  const privateIssue = await createIssue(owner, "rights-maintenance", "private");
  const privateIssueId = String(privateIssue.id);
  await expectActionError(
    "not-found",
    () => callAction("getIssue", { issueId: privateIssueId }, stranger.auth),
  );
  await expectActionError(
    "permission-denied",
    () => callAction("moderateIssueStatus", {
      issueId: privateIssueId,
      requestId: requestId("public-manager-private"),
      status: "processing",
    }, publicManager.auth),
  );
  const privateManaged = asRecord(await callAction("moderateIssueStatus", {
    issueId: privateIssueId,
    requestId: requestId("rights-manager-private"),
    status: "processing",
  }, rightsManager.auth));
  assert.equal(asRecord(privateManaged.issue).status, "processing");

  const ownerDeleteIssue = await createIssue(owner, "rights-maintenance", "owner-delete");
  await expectActionError(
    "permission-denied",
    () => callAction("deleteIssue", {
      issueId: String(ownerDeleteIssue.id),
      requestId: requestId("stranger-delete-issue"),
    }, stranger.auth),
  );
  await callAction("deleteIssue", {
    issueId: String(ownerDeleteIssue.id),
    requestId: requestId("owner-delete-issue"),
  }, owner.auth);
  await callAction("deleteIssue", {
    issueId: publicIssueId,
    requestId: requestId("admin-delete-issue"),
  }, admin.auth);
});

type JsonRecord = Record<string, unknown>;
