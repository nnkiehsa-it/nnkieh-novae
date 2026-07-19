import { asRecord, asString } from "../_shared/http.ts";
import type { AuthContext, BackendSupabase, JsonRecord } from "./types.ts";
import { issueCategoryPolicyLists } from "./categories.ts";
import { asUuid } from "./utils.ts";
import { canManageIssueCategory } from "./auth.ts";
import { selectIssue } from "./issue-shared.ts";

export async function updateSupport(action: string, payload: JsonRecord, auth: AuthContext, supabase: BackendSupabase) {
  const issueId = asUuid(payload.issueId);
  if (!issueId) throw new Error("not-found");
  const storedIssue = await selectIssue(supabase, issueId);
  const policy = await issueCategoryPolicyLists(supabase);
  const { data: issueData, error: issueError } = await supabase.schema("app_api").rpc("backend_get_issue", {
    issue_id: issueId,
    actor_uid: auth.uid,
    actor_is_admin: canManageIssueCategory(auth, asString(storedIssue.category)),
    private_to_owner_categories: policy.privateToOwnerCategoryIds,
    review_required_categories: policy.reviewRequiredCategoryIds,
    author_private_categories: policy.authorPrivateCategoryIds,
  });
  if (issueError) throw issueError;
  const issue = asRecord(issueData);
  if (
    asString(issue.status) !== "pending"
    || issue.support_enabled !== true
    || (typeof issue.support_deadline_at === "string" && Date.parse(issue.support_deadline_at) <= Date.now())
  ) throw new Error("support-not-available");

  const { data: result, error: toggleError } = await supabase.schema("app_api")
    .rpc("backend_toggle_support", {
      issue_id: issueId,
      actor_uid: auth.uid,
      remove_support: action === "removeSupport",
      response_deadline_days: storedIssue.response_deadline_days,
    })
    .single();
  if (toggleError) throw toggleError;
  const toggleResult = result as { goal_met: boolean; support_count: number; supported: boolean };
  return { success: true, supported: toggleResult.supported, support_count: toggleResult.support_count };
}
