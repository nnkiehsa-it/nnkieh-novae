import { asString } from "../_shared/http.ts";
import { RATE_LIMITS } from "../_shared/rate-limits.ts";
import { claimFixedWindowRateLimit } from "../_shared/upstash-rate-limit.ts";
import { canReadIssue, selectIssue } from "./issue-shared.ts";
import type { AuthContext, BackendSupabase, JsonRecord } from "./types.ts";
import { utcHourWindow } from "./utils.ts";

export async function updateSupport(action: string, payload: JsonRecord, auth: AuthContext, supabase: BackendSupabase) {
  await claimFixedWindowRateLimit(auth.uid, "support.toggle", utcHourWindow(), RATE_LIMITS.supportToggleHourly);
  const issueId = asString(payload.issueId);
  const issue = await selectIssue(supabase, issueId);
  if (!canReadIssue(issue, auth)) throw new Error("not-found");
  if (asString(issue.status) !== "pending") throw new Error("support-not-available");

  const { data: existing, error: existingError } = await supabase.schema("app_private").from("supports").select("issue_id").eq("issue_id", issueId).eq("uid", auth.uid).maybeSingle();
  if (existingError) throw existingError;
  const shouldRemove = action === "removeSupport" || existing;
  if (shouldRemove) {
    await supabase.schema("app_private").from("supports").delete().eq("issue_id", issueId).eq("uid", auth.uid);
  } else {
    await supabase.schema("app_private").from("supports").insert({ issue_id: issueId, uid: auth.uid });
  }

  const { data: updatedIssue, error: updatedIssueError } = await supabase.schema("app_private").from("issues").select("author_uid,category,status,support_count,support_goal,title").eq("id", issueId).single();
  if (updatedIssueError) throw updatedIssueError;
  await supabase.schema("app_private").from("outbox_events").insert({
    event_type: shouldRemove ? "support.deleted" : "support.created",
    target_type: "issue",
    target_id: issueId,
    actor_uid: auth.uid,
    payload: {
      author_uid: updatedIssue.author_uid,
      issue_category: updatedIssue.category,
      new_support_count: updatedIssue.support_count ?? 0,
      support_goal: updatedIssue.support_goal,
      title: updatedIssue.title,
    },
  });
  if (!shouldRemove && typeof updatedIssue.support_goal === "number" && typeof issue.support_count === "number" && issue.support_count < updatedIssue.support_goal && (updatedIssue.support_count ?? 0) >= updatedIssue.support_goal) {
    await supabase.schema("app_private").from("outbox_events").insert({
      event_type: "support.goal_met",
      target_type: "issue",
      target_id: issueId,
      actor_uid: auth.uid,
      payload: {
        author_uid: updatedIssue.author_uid,
        issue_category: updatedIssue.category,
        new_support_count: updatedIssue.support_count ?? 0,
        support_goal: updatedIssue.support_goal,
        title: updatedIssue.title,
      },
    });
  }
  return { success: true, supported: !shouldRemove, support_count: updatedIssue.support_count ?? 0 };
}
