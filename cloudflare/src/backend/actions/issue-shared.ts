import { asString } from "../shared/http.ts";
import type { AuthContext, BackendDatabase, JsonRecord } from "./types.ts";
import { toMs } from "./utils.ts";
import { canManageIssueCategory } from "./auth.ts";
import type { Row, Selected } from "../database/schema.ts";

export function issueToResponse(issue: JsonRecord): JsonRecord {
  return {
    ...issue,
    created_at_ms: toMs(issue.created_at),
    closed_at_ms: toMs(issue.closed_at),
    support_deadline_at_ms: toMs(issue.support_deadline_at),
    review_approved_at_ms: toMs(issue.review_approved_at),
    support_met_at_ms: toMs(issue.support_met_at),
  };
}

export function canReadIssue(issue: JsonRecord, auth: AuthContext) {
  const category = asString(issue.category);
  const authorUid = asString(issue.author_uid);
  const status = asString(issue.status);
  if (canManageIssueCategory(auth, category) || authorUid === auth.uid) return true;
  if (issue.read_access === "owner-admin") return false;
  if (issue.read_access === "reviewed-school" && (status === "under-review" || status === "review-rejected")) return false;
  return true;
}

export function issueToReadableResponse(issue: JsonRecord, auth: AuthContext): JsonRecord {
  const response = issueToResponse(issue);
  const authorUid = asString(issue.author_uid);
  const isOwnIssue = authorUid === auth.uid;
  const actorCanManageCategory = canManageIssueCategory(auth, asString(issue.category));
  const canManageIssue = actorCanManageCategory;
  const canViewAuthor = actorCanManageCategory || isOwnIssue || issue.author_visible === true;

  return {
    ...response,
    isOwnIssue,
    canManageIssue,
    canViewAuthor,
    author_uid: canViewAuthor ? response.author_uid : null,
  };
}

export function commentToResponse(comment: JsonRecord): JsonRecord {
  return {
    ...comment,
    created_at_ms: toMs(comment.created_at),
    replies: Array.isArray(comment.replies)
      ? comment.replies.map((reply) => commentToResponse(reply as JsonRecord))
      : [],
  };
}

export function commentCursor(comment: JsonRecord) {
  return { id: comment.id, createdAtMs: comment.created_at_ms };
}

export async function selectIssue(database: BackendDatabase, issueId: string) {
  const issue = await database.sqlMaybe<Row<"issues">>`
    select * from app_private.issues where id = ${issueId}`;
  if (!issue) throw new Error("not-found");
  return issue;
}

export async function selectIssueCategory(database: BackendDatabase, issueId: string) {
  const issue = await database.sqlMaybe<Selected<"issues", "category">>`
    select category from app_private.issues where id = ${issueId}`;
  if (!issue) throw new Error("not-found");
  return issue.category;
}
