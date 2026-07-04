import { asString } from "../_shared/http.ts";
import {
  getIssueCategoryConfigOrDefault,
  isIssueCategory,
  issueRequiresReview,
  issueStoresAuthorPrivately,
} from "../_shared/issue-categories.ts";
import { RATE_LIMITS } from "../_shared/rate-limits.ts";
import { claimFixedWindowRateLimit } from "../_shared/upstash-rate-limit.ts";
import { issueToReadableResponse } from "./issue-shared.ts";
import type { AuthContext, BackendSupabase, JsonRecord } from "./types.ts";
import { taipeiDayWindow } from "./utils.ts";

export async function createIssue(payload: JsonRecord, auth: AuthContext, supabase: BackendSupabase) {
  await claimFixedWindowRateLimit(auth.uid, "issue.create", taipeiDayWindow(), RATE_LIMITS.issueCreateDaily);
  const title = asString(payload.title);
  const content = asString(payload.content);
  const category = asString(payload.category, "general");
  if (!isIssueCategory(category)) throw new Error("invalid-issue-category");

  const categoryConfig = getIssueCategoryConfigOrDefault(category);
  const now = new Date();
  const supportDeadlineAt = categoryConfig.support.enabled && categoryConfig.support.deadlineDays
    ? new Date(now.getTime() + categoryConfig.support.deadlineDays * 24 * 60 * 60 * 1000).toISOString()
    : null;
  const responseDeadlineAt = categoryConfig.responseDeadline.start === "created" && categoryConfig.responseDeadline.days !== null
    ? new Date(now.getTime() + categoryConfig.responseDeadline.days * 24 * 60 * 60 * 1000).toISOString()
    : null;
  const { data, error } = await supabase.schema("app_private").from("issues").insert({
    author_uid: auth.uid,
    author_name: auth.name,
    author_photo_url: auth.photoUrl,
    category,
    content,
    response_deadline_at: responseDeadlineAt,
    status: issueRequiresReview(category) ? "under-review" : "pending",
    support_deadline_at: supportDeadlineAt,
    support_enabled: categoryConfig.support.enabled,
    support_goal: categoryConfig.support.goal,
    title,
    title_search: title.toLowerCase(),
  }).select("*").single();
  if (error) throw error;

  await supabase.schema("app_private").from("outbox_events").insert({
    event_type: "issue.created",
    target_type: "issue",
    target_id: data.id,
    actor_uid: auth.uid,
    payload: {
      author_name: auth.name,
      author_uid: auth.uid,
      category,
      content,
      issue_id: data.id,
      status: data.status,
      support_count: data.support_count,
      support_goal: data.support_goal,
      title,
    },
  });

  if (issueStoresAuthorPrivately(category)) {
    const { error: privateAuthorError } = await supabase.schema("app_private").from("private_issue_authors").upsert({
      author_name: auth.name,
      author_photo_url: auth.photoUrl,
      author_uid: auth.uid,
      issue_id: data.id,
    }, { onConflict: "issue_id" });
    if (privateAuthorError) throw privateAuthorError;
  }
  return { issue: issueToReadableResponse(data as JsonRecord, auth) };
}
