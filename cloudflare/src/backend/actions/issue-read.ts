import * as v from "valibot";
import type { ActionInput } from "../../../../shared/actions.ts";
import { Issue, IssueCursor, IssueSummary, ISSUE_STATUSES, type IssueStatusCounts } from "../../../../shared/contracts/issues.ts";
import { Count } from "../../../../shared/contract.ts";
import { createMediaDeliveryUrl } from "../shared/media-delivery.ts";
import type { AuthContext, BackendDatabase } from "./types.ts";
import { getIssueCategory, issueCategoryPolicyLists } from "./category-catalog.ts";
import { INPUT_LIMITS, optionalText } from "./validation.ts";
import { canManageIssueCategory } from "./auth.ts";
import { selectIssue } from "./issue-shared.ts";

/** One page of proposals as the database lists them. */
const StoredIssuePage = v.object({
  issues: v.array(IssueSummary),
  hasMore: v.boolean(),
  cursor: v.nullable(IssueCursor),
  statusCounts: v.record(v.string(), Count),
  version: Count,
});

function cursorParams(cursor: ActionInput<"listIssues">["cursor"]) {
  return {
    cursor_id: cursor?.id ?? null,
    cursor_created_at: cursor?.createdAt ?? null,
    cursor_sort_date: cursor?.sortDate ?? null,
    cursor_sort_number: cursor?.sortNumber ?? null,
  };
}

/** Every status counted, for a first page; a later page keeps the counts it was opened with. */
function firstPageCounts(cursor: unknown, counted: Record<string, number>): IssueStatusCounts | null {
  if (cursor) return null;
  return Object.fromEntries(ISSUE_STATUSES.map((status) => [status, counted[status] ?? 0])) as IssueStatusCounts;
}

async function listCategory(
  action: "listIssues" | "searchIssues",
  input: ActionInput<"listIssues">,
  query: string | null,
  auth: AuthContext,
  database: BackendDatabase,
) {
  return v.parse(StoredIssuePage, await database.call("app_api", "backend_list_issues_snapshot", {
    action_name: action,
    actor_can_manage: canManageIssueCategory(auth, input.category),
    actor_uid: auth.uid,
    active_filter: input.category,
    status_bucket: input.statusBucket,
    sort_name: input.sort,
    page_size: input.pageSize,
    title_query: query,
    ...cursorParams(input.cursor),
  }));
}

export async function listIssues(input: ActionInput<"listIssues">, auth: AuthContext, database: BackendDatabase) {
  const { statusCounts, ...page } = await listCategory("listIssues", input, null, auth, database);
  return { ...page, statusCounts: firstPageCounts(input.cursor, statusCounts) };
}

export async function searchIssues(input: ActionInput<"searchIssues">, auth: AuthContext, database: BackendDatabase) {
  const query = optionalText(input.query, "search", INPUT_LIMITS.search).toLowerCase();
  const { issues, hasMore, cursor, version } = await listCategory("searchIssues", input, query, auth, database);
  return { issues, hasMore, cursor, version };
}

export async function listUserIssues(input: ActionInput<"listUserIssues">, auth: AuthContext, database: BackendDatabase) {
  const { statusCounts, ...page } = v.parse(StoredIssuePage, await database.call("app_api", "backend_list_user_issues_snapshot", {
    actor_is_admin: auth.isAdmin,
    actor_uid: auth.uid,
    title_query: optionalText(input.query, "search", INPUT_LIMITS.search).toLowerCase(),
    status_bucket: input.statusBucket,
    sort_name: input.sort,
    page_size: input.pageSize,
    ...cursorParams(input.cursor),
  }));
  return { ...page, statusCounts: firstPageCounts(input.cursor, statusCounts) };
}

/** The category lists the issue functions decide visibility with. */
export async function issuePolicyParams(database: BackendDatabase, auth: AuthContext, actorCanManage: boolean) {
  const policy = await issueCategoryPolicyLists(database);
  return {
    actor_uid: auth.uid,
    actor_is_admin: actorCanManage,
    private_to_owner_categories: policy.privateToOwnerCategoryIds,
    review_required_categories: policy.reviewRequiredCategoryIds,
    author_private_categories: policy.authorPrivateCategoryIds,
  };
}

export async function getIssue(input: ActionInput<"getIssue">, auth: AuthContext, database: BackendDatabase) {
  const stored = await selectIssue(database, input.issueId);
  const category = await getIssueCategory(database, stored.category);
  const actorCanManage = canManageIssueCategory(auth, category.id);
  const issue = v.parse(Issue, await database.call("app_api", "backend_get_issue", {
    issue_id: input.issueId,
    ...await issuePolicyParams(database, auth, actorCanManage),
  }));
  return {
    issue,
    canDeleteIssue: actorCanManage || (stored.author_uid === auth.uid && category.authorDeleteEnabled),
  };
}

interface IssueSupporterRow {
  avatar_public_id: string | null;
  display_name: string | null;
  implicit: boolean;
  photo_url: string | null;
  uid: string;
}

export async function listIssueSupporters(input: ActionInput<"listIssueSupporters">, auth: AuthContext, database: BackendDatabase) {
  const issue = await selectIssue(database, input.issueId);
  if (!canManageIssueCategory(auth, issue.category) && issue.author_uid !== auth.uid) {
    throw new Error("permission-denied");
  }
  if (!issue.support_enabled) return { supporters: [] };

  const { rows } = await database.sql<IssueSupporterRow>`
    with supporter_ids as (
      select ${issue.author_uid}::text as uid, true as implicit, null::timestamptz as supported_at
      union all
      select support.uid, false, support.created_at
      from app_private.supports support
      where support.issue_id = ${input.issueId}
    )
    select supporter.uid, supporter.implicit, profile.display_name,
      profile.avatar_public_id, profile.photo_url
    from supporter_ids supporter
    left join app_private.user_profiles profile on profile.uid = supporter.uid
    order by supporter.implicit desc, supporter.supported_at asc nulls first, supporter.uid`;

  const supporters = await Promise.all(rows.map(async (supporter) => {
    const media = supporter.avatar_public_id
      ? await createMediaDeliveryUrl(supporter.avatar_public_id, "avatar", false, auth.uid)
      : null;
    return {
      uid: supporter.uid,
      displayName: supporter.display_name || supporter.uid,
      photoUrl: media?.url ?? supporter.photo_url ?? null,
      isAuthor: supporter.implicit,
    };
  }));
  return { supporters };
}
