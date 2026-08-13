import { asString } from "../_shared/http.ts";
import type { AuthContext, BackendSupabase, JsonRecord } from "./types.ts";
import { issueCategoryPolicyLists } from "./categories.ts";
import {
  asNumber,
  asUuid,
  readCursor,
  readCursorDate,
} from "./utils.ts";
import { INPUT_LIMITS, optionalText } from "./validation.ts";
import { canManageIssueCategory } from "./auth.ts";
import { selectIssueCategory } from "./issue-shared.ts";

function readSort(payload: JsonRecord) {
  const sort = asString(payload.sort);
  return sort === "most-supported" || sort === "ending-soon" ? sort : "latest";
}

function readPageSize(payload: JsonRecord) {
  return Math.min(Math.max(Math.round(asNumber(payload.pageSize, 20)), 1), 50);
}

async function issueReadPolicyParams(supabase: BackendSupabase, auth: AuthContext, actorCanManage = false) {
  const policy = await issueCategoryPolicyLists(supabase);
  return {
    actor_uid: auth.uid,
    actor_is_admin: actorCanManage,
    private_to_owner_categories: policy.privateToOwnerCategoryIds,
    review_required_categories: policy.reviewRequiredCategoryIds,
    author_private_categories: policy.authorPrivateCategoryIds,
  };
}

function compactIssueListResult(data: unknown): JsonRecord {
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  const result = data as JsonRecord;
  if (!Array.isArray(result.issues)) return result;
  return {
    ...result,
    issues: result.issues.map((value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return value;
      const issue = { ...(value as JsonRecord) };
      delete issue.content;
      return issue;
    }),
  };
}

async function getIssue(
  payload: JsonRecord,
  auth: AuthContext,
  supabase: BackendSupabase,
) {
  const issueId = asUuid(payload.issueId);
  if (!issueId) throw new Error("not-found");
  const [category, policyParams] = await Promise.all([
    selectIssueCategory(supabase, issueId),
    issueReadPolicyParams(supabase, auth),
  ]);
  const actorCanManage = canManageIssueCategory(auth, category);

  const { data, error } = await supabase.schema("app_api").rpc("backend_get_issue", {
    issue_id: issueId,
    ...policyParams,
    actor_is_admin: actorCanManage,
  });
  if (error) throw error;
  return {
    issue: data && typeof data === "object" && !Array.isArray(data)
      ? { ...(data as JsonRecord), canManageIssue: actorCanManage }
      : data,
  };
}

async function listIssues(
  action: string,
  payload: JsonRecord,
  auth: AuthContext,
  supabase: BackendSupabase,
) {
  const category = asString(payload.activeFilter);

  const cursor = readCursor(payload);
  const titleQuery = action === "searchIssues"
    ? optionalText(payload.titleQuery, "search", INPUT_LIMITS.search).toLowerCase()
    : null;
  const { data, error } = await supabase.schema("app_api").rpc("backend_list_issues_snapshot", {
    action_name: action,
    actor_can_manage: canManageIssueCategory(auth, category),
    actor_uid: auth.uid,
    active_filter: category,
    status_bucket: asString(payload.statusBucket, "active"),
    sort_name: readSort(payload),
    page_size: readPageSize(payload),
    title_query: titleQuery,
    cursor_id: asUuid(cursor.id) || null,
    cursor_created_at: readCursorDate(cursor, "created_at") || null,
    cursor_sort_date: readCursorDate(cursor, "sort_date") || null,
    cursor_sort_number: Number.isFinite(asNumber(cursor.sort_number, Number.NaN))
      ? asNumber(cursor.sort_number, Number.NaN)
      : null,
  });
  if (error) throw error;
  return compactIssueListResult(data);
}

async function listUserIssues(
  payload: JsonRecord,
  auth: AuthContext,
  supabase: BackendSupabase,
) {
  const cursor = readCursor(payload);
  const { data, error } = await supabase.schema("app_api").rpc("backend_list_user_issues_snapshot", {
    actor_is_admin: auth.isAdmin,
    actor_uid: auth.uid,
    status_bucket: asString(payload.statusBucket, "active"),
    sort_name: readSort(payload),
    page_size: readPageSize(payload),
    cursor_id: asUuid(cursor.id) || null,
    cursor_created_at: readCursorDate(cursor, "created_at") || null,
    cursor_sort_date: readCursorDate(cursor, "sort_date") || null,
    cursor_sort_number: Number.isFinite(asNumber(cursor.sort_number, Number.NaN))
      ? asNumber(cursor.sort_number, Number.NaN)
      : null,
  });
  if (error) throw error;
  return compactIssueListResult(data);
}

export function isIssueReadAction(action: string) {
  return action === "getIssue"
    || action === "listIssues"
    || action === "searchIssues"
    || action === "listUserIssues";
}

export async function handleIssueReadAction(
  action: string,
  payload: JsonRecord,
  auth: AuthContext,
  supabase: BackendSupabase,
) {
  if (action === "getIssue") return getIssue(payload, auth, supabase);
  if (action === "listIssues" || action === "searchIssues") return listIssues(action, payload, auth, supabase);
  if (action === "listUserIssues") return listUserIssues(payload, auth, supabase);
  throw new Error("invalid-action");
}
