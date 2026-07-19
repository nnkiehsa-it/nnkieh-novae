import { asRecord, asString } from "../_shared/http.ts";
import { canManageIssueCategory, requireIssueCategoryPermission } from "./auth.ts";
import { issueCategoryPolicyLists } from "./categories.ts";
import { issueToReadableResponse } from "./issue-shared.ts";
import type { AuthContext, BackendSupabase, JsonRecord } from "./types.ts";
import { asUuid } from "./utils.ts";
import { INPUT_LIMITS, optionalText } from "./validation.ts";

const VALID_STATUSES = new Set([
  "under-review", "pending", "processing", "auto-rejected",
  "review-rejected", "infeasible", "completed",
]);

async function issuePolicyParams(supabase: BackendSupabase, auth: AuthContext, actorCanManage: boolean) {
  const policy = await issueCategoryPolicyLists(supabase);
  return {
    actor_uid: auth.uid,
    actor_is_admin: actorCanManage,
    private_to_owner_categories: policy.privateToOwnerCategoryIds,
    review_required_categories: policy.reviewRequiredCategoryIds,
    author_private_categories: policy.authorPrivateCategoryIds,
  };
}

async function readIssueForAdmin(supabase: BackendSupabase, issueId: string, auth: AuthContext) {
  const { data: storedIssue, error: storedIssueError } = await supabase.schema("app_private")
    .from("issues").select("*").eq("id", issueId).maybeSingle();
  if (storedIssueError) throw storedIssueError;
  if (!storedIssue) throw new Error("not-found");
  requireIssueCategoryPermission(auth, storedIssue.category);
  return asRecord(storedIssue);
}

export async function moderateIssueStatus(payload: JsonRecord, auth: AuthContext, supabase: BackendSupabase) {
  const issueId = asUuid(payload.issueId);
  if (!issueId) throw new Error("not-found");
  const oldIssue = await readIssueForAdmin(supabase, issueId, auth);
  const nextStatus = asString(payload.status, "pending");
  if (!VALID_STATUSES.has(nextStatus)) throw new Error("invalid-status");
  const category = asString(oldIssue.category);
  requireIssueCategoryPermission(auth, category);
  const oldStatus = asString(oldIssue.status);
  const now = new Date();
  let reviewApprovedAt = typeof oldIssue.review_approved_at === "string" ? oldIssue.review_approved_at : null;
  let supportDeadlineAt = typeof oldIssue.support_deadline_at === "string" ? oldIssue.support_deadline_at : null;
  let responseDeadlineAt: string | null = null;
  if (nextStatus === "pending" && oldIssue.support_enabled === true) {
    if (oldIssue.read_access === "reviewed-school" && (oldStatus === "under-review" || oldStatus === "review-rejected")) {
      reviewApprovedAt = now.toISOString();
    }
    supportDeadlineAt = typeof oldIssue.support_deadline_days === "number"
      ? new Date(now.getTime() + oldIssue.support_deadline_days * 24 * 60 * 60 * 1000).toISOString()
      : null;
  }
  if (nextStatus === "under-review" || nextStatus === "review-rejected") {
    reviewApprovedAt = null;
    supportDeadlineAt = null;
  }
  if (nextStatus === "processing" && typeof oldIssue.response_deadline_days === "number") {
    responseDeadlineAt = new Date(now.getTime() + oldIssue.response_deadline_days * 24 * 60 * 60 * 1000).toISOString();
  }
  const { data, error } = await supabase.schema("app_api").rpc("backend_moderate_issue_status", {
    issue_id: issueId,
    next_status: nextStatus,
    review_rejection_reason: optionalText(payload.reason, "reason", INPUT_LIMITS.rejectionReason) || null,
    review_approved_at: reviewApprovedAt,
    support_deadline_at: supportDeadlineAt,
    response_deadline_at: responseDeadlineAt,
    ...await issuePolicyParams(supabase, auth, canManageIssueCategory(auth, category)),
  });
  if (error) throw error;
  return { issue: data };
}

export async function updateIssueResult(payload: JsonRecord, auth: AuthContext, supabase: BackendSupabase) {
  const issueId = asUuid(payload.issueId);
  if (!issueId) throw new Error("not-found");
  const oldIssue = await readIssueForAdmin(supabase, issueId, auth);
  const category = asString(oldIssue.category);
  const resultContent = optionalText(payload.resultContent, "issue-result", INPUT_LIMITS.issueResult).trim();
  const { data, error } = await supabase.schema("app_api").rpc("backend_update_issue_result", {
    issue_id: issueId,
    result_content: resultContent || null,
    ...await issuePolicyParams(supabase, auth, canManageIssueCategory(auth, category)),
  });
  if (error) throw error;
  return { issue: data };
}

export async function setIssueCommentsEnabled(payload: JsonRecord, auth: AuthContext, supabase: BackendSupabase) {
  const issueId = asUuid(payload.issueId);
  if (!issueId) throw new Error("not-found");
  if (typeof payload.enabled !== "boolean") throw new Error("validation-required");
  await readIssueForAdmin(supabase, issueId, auth);
  const { data, error } = await supabase.schema("app_private").from("issues")
    .update({ comments_enabled: payload.enabled }).eq("id", issueId).select("*").single();
  if (error) throw error;
  return { issue: issueToReadableResponse(asRecord(data), auth) };
}
