import { createIssue } from "./issue-create.ts";
import { deleteIssue } from "./issue-delete.ts";
import { moderateIssueStatus, updateIssueResult } from "./issue-moderation.ts";
import { updateSupport } from "./issue-support.ts";
import type { AuthContext, BackendDatabase, JsonRecord } from "./types.ts";

export function isIssueWriteAction(action: string) {
  return action === "createIssue"
    || action === "moderateIssueStatus"
    || action === "updateIssueResult"
    || action === "toggleSupport"
    || action === "removeSupport"
    || action === "deleteIssue";
}

export async function handleIssueWriteAction(
  action: string,
  payload: JsonRecord,
  auth: AuthContext,
  database: BackendDatabase,
) {
  if (action === "createIssue") return createIssue(payload, auth, database);
  if (action === "moderateIssueStatus") return moderateIssueStatus(payload, auth, database);
  if (action === "updateIssueResult") return updateIssueResult(payload, auth, database);
  if (action === "toggleSupport" || action === "removeSupport") return updateSupport(action, payload, auth, database);
  if (action === "deleteIssue") return deleteIssue(payload, auth, database);
  throw new Error("invalid-action");
}
