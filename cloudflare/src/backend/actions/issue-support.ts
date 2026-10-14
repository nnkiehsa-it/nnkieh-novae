import { asRecord, asString } from "../shared/json.ts";
import type { AuthContext, BackendDatabase, JsonRecord } from "./types.ts";
import { issueCategoryPolicyLists } from "./category-catalog.ts";
import { asUuid } from "./utils.ts";
import { canManageIssueCategory } from "./auth.ts";
import { selectIssue } from "./issue-shared.ts";

export async function updateSupport(action: string, payload: JsonRecord, auth: AuthContext, database: BackendDatabase) {
  const issueId = asUuid(payload.issueId);
  if (!issueId) throw new Error("not-found");
  const storedIssue = await selectIssue(database, issueId, true);
  const policy = await issueCategoryPolicyLists(database);
  const issueData = await database.call("app_api", "backend_get_issue", {
    issue_id: issueId,
    actor_uid: auth.uid,
    actor_is_admin: canManageIssueCategory(auth, asString(storedIssue.category)),
    private_to_owner_categories: policy.privateToOwnerCategoryIds,
    review_required_categories: policy.reviewRequiredCategoryIds,
    author_private_categories: policy.authorPrivateCategoryIds,
  });
  const issue = asRecord(issueData);
  // Reaching the threshold is not a cap on how many people may ask for
  // something: a proposal that has moved on to being worked on stays open to
  // support, and only its deadline closes it.
  const status = asString(issue.status);
  if (
    (status !== "pending" && status !== "processing")
    || issue.supportEnabled !== true
    || (typeof issue.supportDeadlineAt === "string" && Date.parse(issue.supportDeadlineAt) <= Date.now())
    || (action !== "removeSupport" && (issue.isOwnIssue === true || storedIssue.author_uid === auth.uid))
  ) throw new Error("support-not-available");

  const rows = await database.call("app_api", "backend_toggle_support", {
    issue_id: issueId,
    actor_uid: auth.uid,
    remove_support: action === "removeSupport",
  });
  if (rows.length !== 1) throw new Error("not-found");
  const toggleResult = rows[0];
  return {
    success: true,
    supported: toggleResult.supported,
    support_count: toggleResult.support_count,
    goal_met: toggleResult.goal_met,
    title: asString(issue.title),
    issue_category: asString(issue.category),
  };
}
