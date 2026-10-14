import * as v from "valibot";
import type { ActionInput } from "../../../../shared/actions.ts";
import { Issue, IssueStatus } from "../../../../shared/contracts/issues.ts";
import { IssueReadAccess } from "../../../../shared/contracts/categories.ts";
import type { AuthContext, BackendDatabase } from "./types.ts";
import { getIssueCategory, issueCategoryPolicyLists } from "./category-catalog.ts";
import { validateMarkdownUploadsBeforeCreate } from "./upload-markdown.ts";
import { INPUT_LIMITS, optionalText, requiredMediaContent, requiredText } from "./validation.ts";
import { canManageIssueCategory, requireIssueCategoryPermission } from "./auth.ts";
import { issuePolicyParams } from "./issue-read.ts";
import { selectIssue } from "./issue-shared.ts";
import type { Row } from "../database/schema.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

function daysFrom(now: Date, days: number) {
  return new Date(now.getTime() + days * DAY_MS).toISOString();
}

export async function createIssue(input: ActionInput<"createIssue">, auth: AuthContext, database: BackendDatabase) {
  const title = requiredText(input.title, "title", INPUT_LIMITS.title);
  const content = requiredMediaContent(input.content, "content", INPUT_LIMITS.content, INPUT_LIMITS.contentStorage);
  await validateMarkdownUploadsBeforeCreate(database, auth.uid, content, "issue", input.category);

  const [category, policyLists] = await Promise.all([
    getIssueCategory(database, input.category),
    issueCategoryPolicyLists(database),
  ]);
  const requiresReview = category.readAccess === "reviewed-school";
  // A proposal under review starts its support period when it is approved.
  const supportDeadlineAt = !requiresReview && category.supportEnabled && category.supportDeadlineDays !== null
    ? daysFrom(new Date(), category.supportDeadlineDays)
    : null;
  const issue = v.parse(Issue, await database.call("app_api", "backend_create_issue", {
    actor_uid: auth.uid,
    issue_title: title,
    issue_content: content,
    issue_category: category.id,
    issue_status: requiresReview ? "under-review" : "pending",
    support_enabled: category.supportEnabled,
    support_goal: category.supportGoal,
    support_deadline_at: supportDeadlineAt,
    author_is_private: !category.authorVisible,
    actor_is_admin: false,
    private_to_owner_categories: policyLists.privateToOwnerCategoryIds,
    review_required_categories: policyLists.reviewRequiredCategoryIds,
    author_private_categories: policyLists.authorPrivateCategoryIds,
  }));
  return { issue };
}

/** The proposal locked for a moderator who may manage its category. */
async function lockForModeration(database: BackendDatabase, issueId: string, auth: AuthContext) {
  const stored = await database.sqlMaybe<Row<"issues">>`
    select * from app_private.issues where id = ${issueId} for update`;
  if (!stored) throw new Error("not-found");
  requireIssueCategoryPermission(auth, stored.category);
  return stored;
}

const CLOSED_WITH_RESULT: readonly IssueStatus[] = ["completed", "infeasible"];

export async function moderateIssueStatus(input: ActionInput<"moderateIssueStatus">, auth: AuthContext, database: BackendDatabase) {
  const stored = await lockForModeration(database, input.issueId, auth);
  const resultContent = CLOSED_WITH_RESULT.includes(input.status)
    ? requiredText(input.resultContent, "issue-result", INPUT_LIMITS.issueResult)
    : null;
  const now = new Date();
  let reviewApprovedAt = stored.review_approved_at;
  let supportDeadlineAt = stored.support_deadline_at;
  if (input.status === "pending" && stored.support_enabled) {
    if (stored.read_access === "reviewed-school" && (stored.status === "under-review" || stored.status === "review-rejected")) {
      reviewApprovedAt = now.toISOString();
    }
    supportDeadlineAt = stored.support_deadline_days === null ? null : daysFrom(now, stored.support_deadline_days);
  }
  if (input.status === "under-review" || input.status === "review-rejected") {
    reviewApprovedAt = null;
    supportDeadlineAt = null;
  }
  const issue = v.parse(Issue, await database.call("app_api", "backend_moderate_issue_status", {
    issue_id: input.issueId,
    next_status: input.status,
    result_content: resultContent,
    review_rejection_reason: optionalText(input.reason, "reason", INPUT_LIMITS.rejectionReason) || null,
    review_approved_at: reviewApprovedAt,
    support_deadline_at: supportDeadlineAt,
    ...await issuePolicyParams(database, auth, true),
  }));
  return {
    issue,
    // What the events announce: the move it made and whether the result text changed.
    previousStatus: stored.status,
    resultChanged: issue.resultContent !== stored.result_content,
  };
}

async function setSupport(issueId: string, remove: boolean, auth: AuthContext, database: BackendDatabase) {
  const stored = await selectIssue(database, issueId, true);
  const issue = v.parse(Issue, await database.call("app_api", "backend_get_issue", {
    issue_id: issueId,
    ...await issuePolicyParams(database, auth, canManageIssueCategory(auth, stored.category)),
  }));
  // Reaching the threshold is not a cap on how many people may ask for
  // something: a proposal that has moved on to being worked on stays open to
  // support, and only its deadline closes it.
  if (
    (issue.status !== "pending" && issue.status !== "processing")
    || !issue.supportEnabled
    || (issue.supportDeadlineAt !== null && Date.parse(issue.supportDeadlineAt) <= Date.now())
    || (!remove && stored.author_uid === auth.uid)
  ) throw new Error("support-not-available");

  const rows = await database.call("app_api", "backend_toggle_support", {
    issue_id: issueId,
    actor_uid: auth.uid,
    remove_support: remove,
  });
  if (rows.length !== 1) throw new Error("not-found");
  const [{ supported, support_count: supportCount, goal_met: goalMet }] = rows;
  // The title and category are what a reached goal announces.
  return { supported, supportCount, goalMet, title: issue.title, category: issue.category };
}

export function toggleSupport(input: ActionInput<"toggleSupport">, auth: AuthContext, database: BackendDatabase) {
  return setSupport(input.issueId, false, auth, database);
}

export function removeSupport(input: ActionInput<"removeSupport">, auth: AuthContext, database: BackendDatabase) {
  return setSupport(input.issueId, true, auth, database);
}

/** What a deleted proposal leaves behind for the people it concerned. */
const DeletedIssue = v.object({
  issueId: v.string(),
  authorUid: v.string(),
  issueCategory: v.string(),
  readAccess: IssueReadAccess,
  status: IssueStatus,
  title: v.string(),
  supporterUids: v.array(v.string()),
});

export async function deleteIssue(input: ActionInput<"deleteIssue">, auth: AuthContext, database: BackendDatabase) {
  const stored = await selectIssue(database, input.issueId);
  const category = await getIssueCategory(database, stored.category);
  const deleted = v.parse(DeletedIssue, await database.call("app_api", "backend_delete_issue", {
    issue_id: input.issueId,
    actor_uid: auth.uid,
    actor_can_manage: canManageIssueCategory(auth, category.id),
    author_delete_enabled: category.authorDeleteEnabled,
  }));
  return { success: true as const, ...deleted };
}
