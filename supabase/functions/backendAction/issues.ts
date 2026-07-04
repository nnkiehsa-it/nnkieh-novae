import type { AuthContext, BackendSupabase, JsonRecord } from "./types.ts";
import { handleIssueCommentAction, isIssueCommentAction } from "./issue-comments.ts";
import { handleIssueReadAction, isIssueReadAction } from "./issue-read.ts";
import { handleIssueWriteAction, isIssueWriteAction } from "./issue-write.ts";

export function isIssueAction(action: string) {
  return isIssueReadAction(action) || isIssueWriteAction(action) || isIssueCommentAction(action);
}

export async function handleIssueAction(
  action: string,
  payload: JsonRecord,
  auth: AuthContext,
  supabase: BackendSupabase,
) {
  if (isIssueReadAction(action)) return handleIssueReadAction(action, payload, auth, supabase);
  if (isIssueWriteAction(action)) return handleIssueWriteAction(action, payload, auth, supabase);
  if (isIssueCommentAction(action)) return handleIssueCommentAction(action, payload, auth, supabase);
  throw new Error("unsupported-action");
}
