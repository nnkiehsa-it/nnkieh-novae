import { asString } from "../_shared/http.ts";
import { RATE_LIMITS } from "../_shared/rate-limits.ts";
import { claimFixedWindowRateLimit } from "../_shared/upstash-rate-limit.ts";
import { canReadIssue, selectIssue } from "./issue-shared.ts";
import type { AuthContext, BackendSupabase, JsonRecord } from "./types.ts";
import { utcHourWindow } from "./utils.ts";
import { getIssueCategoryConfigOrDefault, issueAllowsSupport } from "../_shared/issue-categories.ts";

export async function updateSupport(action: string, payload: JsonRecord, auth: AuthContext, supabase: BackendSupabase) {
  await claimFixedWindowRateLimit(auth.uid, "support.toggle", utcHourWindow(), RATE_LIMITS.supportToggleHourly);
  const issueId = asString(payload.issueId);
  const issue = await selectIssue(supabase, issueId);
  if (!canReadIssue(issue, auth)) throw new Error("not-found");
  if (
    asString(issue.status) !== "pending"
    || issue.support_enabled !== true
    || !issueAllowsSupport(asString(issue.category))
    || (typeof issue.support_deadline_at === "string" && Date.parse(issue.support_deadline_at) <= Date.now())
  ) throw new Error("support-not-available");

  const categoryConfig = getIssueCategoryConfigOrDefault(asString(issue.category));
  const { data: result, error: toggleError } = await supabase.schema("app_api")
    .rpc("backend_toggle_support", {
      issue_id: issueId,
      actor_uid: auth.uid,
      remove_support: action === "removeSupport",
      response_deadline_days: categoryConfig.responseDeadline.days,
    })
    .single();
  if (toggleError) throw toggleError;
  const toggleResult = result as { goal_met: boolean; support_count: number; supported: boolean };
  return { success: true, supported: toggleResult.supported, support_count: toggleResult.support_count };
}
