import * as v from "valibot";
import type { ActionInput } from "../../../../shared/actions.ts";
import { Comment, CommentPage } from "../../../../shared/contracts/discussions.ts";
import type { AuthContext, BackendDatabase } from "./types.ts";
import { issueCategoryPolicyLists } from "./category-catalog.ts";
import { validateMarkdownUploadsBeforeCreate } from "./upload-markdown.ts";
import { INPUT_LIMITS, requiredMediaContent } from "./validation.ts";
import { canManageIssueCategory } from "./auth.ts";
import { selectIssue } from "./issue-shared.ts";
import { loadContentVersion } from "./content-versions.ts";
import type { Selected } from "../database/schema.ts";

/** Who may read and write a proposal's comments, as the comment functions decide it. */
async function commentPolicyParams(database: BackendDatabase, auth: AuthContext, actorCanManage: boolean) {
  const policy = await issueCategoryPolicyLists(database);
  return {
    actor_uid: auth.uid,
    actor_is_admin: actorCanManage,
    private_to_owner_categories: policy.privateToOwnerCategoryIds,
    review_required_categories: policy.reviewRequiredCategoryIds,
    public_comment_categories: policy.publicCommentCategoryIds,
  };
}

const StoredCommentPage = v.omit(CommentPage, ["version"]);

export async function listComments(input: ActionInput<"listComments">, auth: AuthContext, database: BackendDatabase) {
  const issue = await selectIssue(database, input.issueId);
  const [version, policyParams] = await Promise.all([
    loadContentVersion(database, "issues"),
    commentPolicyParams(database, auth, canManageIssueCategory(auth, issue.category)),
  ]);
  const page = v.parse(StoredCommentPage, await database.call("app_api", "backend_list_issue_comments", {
    issue_id: input.issueId,
    cursor_id: input.cursor?.id ?? null,
    cursor_created_at: input.cursor?.createdAt ?? null,
    page_size: input.pageSize,
    sort_name: input.sort,
    ...policyParams,
  }));
  return { ...page, version };
}

const CLOSED_TO_COMMENTS = new Set(["completed", "infeasible", "review-rejected", "auto-rejected"]);

export async function createComment(input: ActionInput<"createComment">, auth: AuthContext, database: BackendDatabase) {
  const issue = await selectIssue(database, input.issueId, true);
  if (!issue.comments_enabled || CLOSED_TO_COMMENTS.has(issue.status)) throw new Error("comments-disabled");
  const content = requiredMediaContent(input.content, "comment", INPUT_LIMITS.comment, INPUT_LIMITS.commentStorage);
  const [, policyParams] = await Promise.all([
    validateMarkdownUploadsBeforeCreate(database, auth.uid, content, "comment", input.issueId),
    commentPolicyParams(database, auth, canManageIssueCategory(auth, issue.category)),
  ]);
  const comment = v.parse(Comment, await database.call("app_api", "backend_create_issue_comment", {
    issue_id: input.issueId,
    parent_comment_id: input.parentCommentId,
    comment_content: content,
    ...policyParams,
  }));
  // The category is what decides who hears about the comment.
  return { comment, issueCategory: issue.category };
}

export async function deleteComment(input: ActionInput<"deleteComment">, auth: AuthContext, database: BackendDatabase) {
  const comment = await database.sqlMaybe<Selected<"comments", "issue_id">>`
    select issue_id from app_private.comments where id = ${input.commentId}`;
  if (!comment) throw new Error("not-found");
  const issue = await selectIssue(database, comment.issue_id);
  await database.call("app_api", "backend_delete_issue_comment", {
    comment_id: input.commentId,
    actor_uid: auth.uid,
    actor_is_admin: canManageIssueCategory(auth, issue.category),
  });
  // The proposal is what the deletion is announced on.
  return { success: true as const, issueId: issue.id };
}
