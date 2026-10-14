import { asString } from "../shared/json.ts";
import type { AuthContext, BackendDatabase, JsonRecord } from "./types.ts";
import { canManageIssueCategory } from "./auth.ts";
import type { Row } from "../database/schema.ts";

export function canReadIssue(issue: JsonRecord, auth: AuthContext) {
  const category = asString(issue.category);
  const authorUid = asString(issue.author_uid);
  const status = asString(issue.status);
  if (canManageIssueCategory(auth, category) || authorUid === auth.uid) return true;
  if (issue.read_access === "owner-admin") return false;
  if (issue.read_access === "reviewed-school" && (status === "under-review" || status === "review-rejected")) return false;
  return true;
}

export async function selectIssue(database: BackendDatabase, issueId: string, lock = false) {
  const issue = lock
    ? await database.sqlMaybe<Row<"issues">>`select * from app_private.issues where id = ${issueId} for update`
    : await database.sqlMaybe<Row<"issues">>`select * from app_private.issues where id = ${issueId}`;
  if (!issue) throw new Error("not-found");
  return issue;
}

