import { asRecord, asString } from "../_shared/http.ts";
import type { AuthContext, BackendSupabase, JsonRecord } from "./types.ts";
import { issueCategoryPolicyLists } from "./categories.ts";
import { validateMarkdownUploadsBeforeCreate } from "./uploads.ts";
import { asNumber, asUuid, readCursor, readCursorDate } from "./utils.ts";
import { INPUT_LIMITS, requiredMediaContent } from "./validation.ts";
import { canManageIssueCategory } from "./auth.ts";
import { selectIssue } from "./issue-shared.ts";

async function issueCommentPolicyParams(supabase: BackendSupabase, auth: AuthContext, actorCanManage: boolean) {
  const policy = await issueCategoryPolicyLists(supabase);
  return {
    actor_uid: auth.uid,
    actor_is_admin: actorCanManage,
    private_to_owner_categories: policy.privateToOwnerCategoryIds,
    review_required_categories: policy.reviewRequiredCategoryIds,
    public_comment_categories: policy.publicCommentCategoryIds,
  };
}

async function listComments(payload: JsonRecord, auth: AuthContext, supabase: BackendSupabase) {
  const issueId = asUuid(payload.issueId);
  if (!issueId) throw new Error("not-found");
  const issue = await selectIssue(supabase, issueId);
  const cursor = readCursor(payload);
  const { data, error } = await supabase.schema("app_api").rpc("backend_list_issue_comments", {
    issue_id: issueId,
    cursor_id: asUuid(cursor.id) || null,
    cursor_created_at: readCursorDate(cursor, "createdAtMs", "created_at") || null,
    page_size: Math.min(Math.max(Math.round(asNumber(payload.pageSize, 30)), 1), 30),
    ...await issueCommentPolicyParams(supabase, auth, canManageIssueCategory(auth, asString(issue.category))),
  });
  if (error) throw error;
  return data;
}

async function createComment(payload: JsonRecord, auth: AuthContext, supabase: BackendSupabase) {
  const issueId = asUuid(payload.issueId);
  if (!issueId) throw new Error("not-found");
  const issue = await selectIssue(supabase, issueId);
  if (issue.comments_enabled === false) throw new Error("comments-disabled");
  const content = requiredMediaContent(
    payload.content,
    "comment",
    INPUT_LIMITS.comment,
    INPUT_LIMITS.commentStorage,
  );
  const parentCommentId = asUuid(payload.parentCommentId) || null;
  await validateMarkdownUploadsBeforeCreate(supabase, auth.uid, content, "comment");
  const { data, error } = await supabase.schema("app_api").rpc("backend_create_issue_comment", {
    issue_id: issueId,
    parent_comment_id: parentCommentId,
    actor_name: auth.name,
    actor_photo_url: auth.photoUrl,
    comment_content: content,
    ...await issueCommentPolicyParams(supabase, auth, canManageIssueCategory(auth, asString(issue.category))),
  });
  if (error) throw error;
  return { comment: asRecord(data) };
}

async function deleteComment(payload: JsonRecord, auth: AuthContext, supabase: BackendSupabase) {
  const commentId = asUuid(payload.commentId);
  if (!commentId) return { success: true };
  const { data: comment, error: commentError } = await supabase.schema("app_private")
    .from("comments").select("issue_id").eq("id", commentId).maybeSingle();
  if (commentError) throw commentError;
  if (!comment) return { success: true };
  const issue = await selectIssue(supabase, comment.issue_id);
  const { error } = await supabase.schema("app_api").rpc("backend_delete_issue_comment", {
    comment_id: commentId,
    actor_uid: auth.uid,
    actor_is_admin: canManageIssueCategory(auth, asString(issue.category)),
  });
  if (error) throw error;
  return { success: true };
}

export function isIssueCommentAction(action: string) {
  return action === "listComments" || action === "createComment" || action === "deleteComment";
}

export async function handleIssueCommentAction(
  action: string,
  payload: JsonRecord,
  auth: AuthContext,
  supabase: BackendSupabase,
) {
  if (action === "listComments") return listComments(payload, auth, supabase);
  if (action === "createComment") return createComment(payload, auth, supabase);
  if (action === "deleteComment") return deleteComment(payload, auth, supabase);
  throw new Error("invalid-action");
}
