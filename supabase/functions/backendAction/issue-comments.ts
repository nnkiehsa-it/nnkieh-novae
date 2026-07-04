import { asString } from "../_shared/http.ts";
import { issueAllowsCommentsForStatus } from "../_shared/issue-categories.ts";
import { RATE_LIMITS } from "../_shared/rate-limits.ts";
import { claimFixedWindowRateLimit } from "../_shared/upstash-rate-limit.ts";
import { canReadIssue, commentCursor, commentToResponse, selectIssue } from "./issue-shared.ts";
import type { AuthContext, BackendSupabase, JsonRecord } from "./types.ts";
import { applyAscendingDateCursor, asBoolean, readCursor, utcHourWindow } from "./utils.ts";

async function listComments(payload: JsonRecord, auth: AuthContext, supabase: BackendSupabase) {
  const pageSize = 20;
  const issue = await selectIssue(supabase, asString(payload.issueId));
  if (!canReadIssue(issue, auth) || !issueAllowsCommentsForStatus(asString(issue.category), asString(issue.status))) {
    throw new Error("not-found");
  }
  let query = supabase.schema("app_private").from("comments").select("*").eq("issue_id", asString(payload.issueId));
  query = applyAscendingDateCursor(query, readCursor(payload), "created_at");
  const { data, error } = await query.order("created_at", { ascending: true }).order("id", { ascending: true }).limit(pageSize + 1);
  if (error) throw error;
  const comments = (data ?? []).map((comment) => commentToResponse(comment as JsonRecord));
  const lastComment = comments[Math.min(pageSize - 1, comments.length - 1)];
  return {
    comments: comments.slice(0, pageSize),
    cursor: comments.length > pageSize && lastComment ? commentCursor(lastComment) : null,
    hasMore: comments.length > pageSize,
  };
}

async function createComment(payload: JsonRecord, auth: AuthContext, supabase: BackendSupabase) {
  await claimFixedWindowRateLimit(auth.uid, "comment.create", utcHourWindow(), RATE_LIMITS.commentCreateHourly);
  const issueId = asString(payload.issueId);
  const issue = await selectIssue(supabase, issueId);
  if (!canReadIssue(issue, auth) || !issueAllowsCommentsForStatus(asString(issue.category), asString(issue.status))) {
    throw new Error("permission-denied");
  }
  const { data, error } = await supabase.schema("app_private").from("comments").insert({
    issue_id: issueId,
    author_uid: auth.uid,
    author_name: auth.name,
    author_photo_url: auth.photoUrl,
    content: asString(payload.content),
    is_admin_comment: asBoolean(payload.isAdminComment) && auth.isAdmin,
  }).select("*").single();
  if (error) throw error;
  await supabase.schema("app_private").from("outbox_events").insert({
    event_type: "issue.comment_created",
    target_type: "issue",
    target_id: issueId,
    actor_uid: auth.uid,
    payload: {
      author_name: auth.name,
      author_photo_url: auth.photoUrl,
      author_uid: auth.uid,
      content: data.content,
      issue_category: issue.category,
      issue_id: issueId,
      title: issue.title,
    },
  });
  return { comment: commentToResponse(data as JsonRecord) };
}

async function deleteComment(payload: JsonRecord, auth: AuthContext, supabase: BackendSupabase) {
  const commentId = asString(payload.commentId);
  const { data } = await supabase.schema("app_private").from("comments").select("*").eq("id", commentId).maybeSingle();
  if (data && data.author_uid !== auth.uid && !auth.isAdmin) throw new Error("permission-denied");
  await supabase.schema("app_private").from("comments").delete().eq("id", commentId);
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
  throw new Error("unsupported-action");
}
