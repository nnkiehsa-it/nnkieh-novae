import { asString } from "../_shared/http.ts";
import type { AuthContext, BackendSupabase, JsonRecord } from "./types.ts";
import { getIssueCategory, issueCategoryPolicyLists } from "./categories.ts";
import { validateMarkdownUploadsBeforeCreate } from "./uploads.ts";
import { INPUT_LIMITS, requiredMediaContent, requiredText } from "./validation.ts";

export async function createIssue(payload: JsonRecord, auth: AuthContext, supabase: BackendSupabase) {
  const title = requiredText(payload.title, "title", INPUT_LIMITS.title);
  const content = requiredMediaContent(
    payload.content,
    "content",
    INPUT_LIMITS.content,
    INPUT_LIMITS.contentStorage,
  );
  const category = asString(payload.category);
  await validateMarkdownUploadsBeforeCreate(supabase, auth.uid, content, "issue");

  const [categoryConfig, policyLists] = await Promise.all([
    getIssueCategory(supabase, category),
    issueCategoryPolicyLists(supabase),
  ]);
  const now = new Date();
  const requiresReview = categoryConfig.readAccess === "reviewed-school";
  const supportDeadlineAt = !requiresReview && categoryConfig.supportEnabled && categoryConfig.supportDeadlineDays !== null
    ? new Date(now.getTime() + categoryConfig.supportDeadlineDays * 24 * 60 * 60 * 1000).toISOString()
    : null;
  const responseDeadlineAt = !categoryConfig.supportEnabled && categoryConfig.responseDeadlineDays !== null
    ? new Date(now.getTime() + categoryConfig.responseDeadlineDays * 24 * 60 * 60 * 1000).toISOString()
    : null;
  const { data, error } = await supabase.schema("app_api").rpc("backend_create_issue", {
    actor_uid: auth.uid,
    actor_name: auth.name,
    actor_photo_url: auth.photoUrl,
    issue_title: title,
    issue_content: content,
    issue_category: category,
    issue_status: requiresReview ? "under-review" : "pending",
    support_enabled: categoryConfig.supportEnabled,
    support_goal: categoryConfig.supportGoal,
    support_deadline_at: supportDeadlineAt,
    response_deadline_at: responseDeadlineAt,
    author_is_private: !categoryConfig.authorVisible,
    actor_is_admin: false,
    private_to_owner_categories: policyLists.privateToOwnerCategoryIds,
    review_required_categories: policyLists.reviewRequiredCategoryIds,
    author_private_categories: policyLists.authorPrivateCategoryIds,
  });
  if (error) throw error;
  return { issue: data };
}
