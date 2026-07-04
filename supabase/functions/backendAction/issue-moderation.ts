import { asString } from "../_shared/http.ts";
import { getIssueCategoryConfigOrDefault } from "../_shared/issue-categories.ts";
import { requireAdmin } from "./auth.ts";
import { issueToReadableResponse, selectIssue } from "./issue-shared.ts";
import type { AuthContext, BackendSupabase, JsonRecord } from "./types.ts";

export async function moderateIssueStatus(payload: JsonRecord, auth: AuthContext, supabase: BackendSupabase) {
  requireAdmin(auth);
  const issueId = asString(payload.issueId);
  const oldIssue = await selectIssue(supabase, issueId);
  const nextStatus = asString(payload.status, "pending");
  const categoryConfig = getIssueCategoryConfigOrDefault(asString(oldIssue.category));
  const updateFields: JsonRecord = {
    review_rejection_reason: asString(payload.reason) || null,
    status: nextStatus,
  };
  if (nextStatus === "pending" && categoryConfig.responseDeadline.start === "support-met") {
    updateFields.support_deadline_at = categoryConfig.support.deadlineDays !== null
      ? new Date(Date.now() + categoryConfig.support.deadlineDays * 24 * 60 * 60 * 1000).toISOString()
      : null;
  }
  if (nextStatus === "processing" && categoryConfig.responseDeadline.days !== null) {
    updateFields.response_deadline_at = new Date(Date.now() + categoryConfig.responseDeadline.days * 24 * 60 * 60 * 1000).toISOString();
  }
  const { data, error } = await supabase.schema("app_private").from("issues").update(updateFields).eq("id", issueId).select("*").single();
  if (error) throw error;
  await supabase.schema("app_private").from("outbox_events").insert({
    event_type: "issue.status_changed",
    target_type: "issue",
    target_id: issueId,
    actor_uid: auth.uid,
    payload: {
      author_uid: data.author_uid,
      new_status: data.status,
      old_status: oldIssue.status,
      reason: data.review_rejection_reason,
      support_count: data.support_count,
      support_goal: data.support_goal,
      title: data.title,
      issue_category: data.category,
    },
  });
  return { issue: issueToReadableResponse(data as JsonRecord, auth) };
}
