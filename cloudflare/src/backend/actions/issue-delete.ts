import type { AuthContext, BackendDatabase, JsonRecord } from "./types.ts";
import { asUuid } from "./utils.ts";
import { asRecord, asString } from "../shared/http.ts";
import { canManageIssueCategory } from "./auth.ts";
import { selectIssue } from "./issue-shared.ts";

export async function deleteIssue(payload: JsonRecord, auth: AuthContext, database: BackendDatabase) {
  const issueId = asUuid(payload.issueId);
  if (!issueId) return { success: true, issueId: "" };
  const issue = await selectIssue(database, issueId);
  const { data, error } = await database.call("app_api", "backend_delete_issue_with_upload_targets", {
    issue_id: issueId,
    actor_uid: auth.uid,
    actor_is_admin: canManageIssueCategory(auth, asString(issue.category)),
  });
  if (error) throw error;
  return { ...asRecord(data), success: true, issueId };
}
