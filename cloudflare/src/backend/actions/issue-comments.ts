import { asRecord, asString } from "../shared/http.ts";
import type { AuthContext, BackendDatabase, JsonRecord } from "./types.ts";
import { issueCategoryPolicyLists } from "./categories.ts";
import { validateMarkdownUploadsBeforeCreate } from "./uploads.ts";
import { asNumber, asUuid, readCursor, readCursorDate } from "./utils.ts";
import { INPUT_LIMITS, requiredMediaContent } from "./validation.ts";
import { canManageIssueCategory } from "./auth.ts";
import { selectIssue } from "./issue-shared.ts";
import { attachContentVersion, loadContentVersion } from "./content-versions.ts";

async function issueCommentPolicyParams(database: BackendDatabase, auth: AuthContext, actorCanManage: boolean) {
  const policy = await issueCategoryPolicyLists(database);
  return {
    actor_uid: auth.uid,
    actor_is_admin: actorCanManage,
    private_to_owner_categories: policy.privateToOwnerCategoryIds,
    review_required_categories: policy.reviewRequiredCategoryIds,
    public_comment_categories: policy.publicCommentCategoryIds,
  };
}

async function listComments(payload: JsonRecord, auth: AuthContext, database: BackendDatabase) {
  const issueId = asUuid(payload.issueId);
  if (!issueId) throw new Error("not-found");
  const issue = await selectIssue(database, issueId);
  const cursor = readCursor(payload);
  const version = await loadContentVersion(database, "issues");
  const sortName = asString(payload.sort) === "oldest" ? "oldest" : "newest";
  const { data, error } = await database.call("app_api", "backend_list_issue_comments", {
    issue_id: issueId,
    cursor_id: asUuid(cursor.id) || null,
    cursor_created_at: readCursorDate(cursor, "createdAt") || null,
    page_size: Math.min(Math.max(Math.round(asNumber(payload.pageSize, 30)), 1), 30),
    sort_name: sortName,
    ...await issueCommentPolicyParams(database, auth, canManageIssueCategory(auth, asString(issue.category))),
  });
  if (error) throw error;
  return attachContentVersion(data, version);
}

async function createComment(payload: JsonRecord, auth: AuthContext, database: BackendDatabase) {
  const issueId = asUuid(payload.issueId);
  if (!issueId) throw new Error("not-found");
  const issue = await selectIssue(database, issueId);
  if (
    issue.comments_enabled === false
    || ["completed", "infeasible", "review-rejected", "auto-rejected"].includes(asString(issue.status))
  ) throw new Error("comments-disabled");
  const content = requiredMediaContent(
    payload.content,
    "comment",
    INPUT_LIMITS.comment,
    INPUT_LIMITS.commentStorage,
  );
  const parentCommentId = asUuid(payload.parentCommentId) || null;
  await validateMarkdownUploadsBeforeCreate(database, auth.uid, content, "comment");
  const { data, error } = await database.call("app_api", "backend_create_issue_comment", {
    issue_id: issueId,
    parent_comment_id: parentCommentId,
    comment_content: content,
    ...await issueCommentPolicyParams(database, auth, canManageIssueCategory(auth, asString(issue.category))),
  });
  if (error) throw error;
  return { comment: asRecord(data) };
}

async function deleteComment(payload: JsonRecord, auth: AuthContext, database: BackendDatabase) {
  const commentId = asUuid(payload.commentId);
  if (!commentId) return { success: true };
  const { data: comment, error: commentError } = await database.table("app_private", "comments").select("issue_id").eq("id", commentId).maybeSingle();
  if (commentError) throw commentError;
  if (!comment) return { success: true };
  const issue = await selectIssue(database, comment.issue_id);
  const { error } = await database.call("app_api", "backend_delete_issue_comment", {
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
  database: BackendDatabase,
) {
  if (action === "listComments") return listComments(payload, auth, database);
  if (action === "createComment") return createComment(payload, auth, database);
  if (action === "deleteComment") return deleteComment(payload, auth, database);
  throw new Error("invalid-action");
}
