import * as v from "valibot";
import { action, Count, NullableTimestamp, OptionalText, pageSize, RequiredText, Success, Timestamp, Uuid } from "../contract.ts";
import { IssueReadAccess } from "./categories.ts";
import { Comment, CommentPage, CommentPaging, NewComment } from "./discussions.ts";
import { ISSUE_STATUSES, IssueStatus } from "./statuses.ts";

export { ISSUE_STATUSES, IssueStatus } from "./statuses.ts";

export const IssueSort = v.picklist(["latest", "most-supported", "ending-soon"]);
export type IssueSort = v.InferOutput<typeof IssueSort>;

export const IssueStatusBucket = v.picklist(["active", "closed"]);
export type IssueStatusBucket = v.InferOutput<typeof IssueStatusBucket>;

/** A proposal as a list shows it. */
export const IssueSummary = v.object({
  id: Uuid,
  title: v.string(),
  category: v.string(),
  status: IssueStatus,
  readAccess: IssueReadAccess,
  commentsEnabled: v.boolean(),
  supportEnabled: v.boolean(),
  supportGoal: v.nullable(Count),
  supportCount: Count,
  supportDeadlineAt: NullableTimestamp,
  supportMetAt: NullableTimestamp,
  reviewApprovedAt: NullableTimestamp,
  reviewRejectionReason: v.nullable(v.string()),
  resultContent: v.nullable(v.string()),
  closedAt: NullableTimestamp,
  createdAt: Timestamp,
  /** True for the author too: an author supports their own proposal. */
  currentUserSupported: v.boolean(),
  isOwnIssue: v.boolean(),
  canViewAuthor: v.boolean(),
  /** Null when the reader may not see who wrote it. */
  authorUid: v.nullable(v.string()),
});
export type IssueSummary = v.InferOutput<typeof IssueSummary>;

/** A proposal with its text. */
export const Issue = v.object({ ...IssueSummary.entries, content: v.string() });
export type Issue = v.InferOutput<typeof Issue>;

export const IssueCursor = v.object({
  id: Uuid,
  createdAt: Timestamp,
  sortDate: NullableTimestamp,
  sortNumber: v.nullable(Count),
});
export type IssueCursor = v.InferOutput<typeof IssueCursor>;

export const IssueStatusCounts = v.object(
  Object.fromEntries(ISSUE_STATUSES.map((status) => [status, Count])) as Record<IssueStatus, typeof Count>,
);
export type IssueStatusCounts = v.InferOutput<typeof IssueStatusCounts>;

const IssuePaging = {
  statusBucket: v.optional(IssueStatusBucket, "active"),
  sort: v.optional(IssueSort, "latest"),
  cursor: v.optional(v.nullable(IssueCursor), null),
  pageSize: pageSize(50, 20),
};

const IssuePage = {
  issues: v.array(IssueSummary),
  hasMore: v.boolean(),
  cursor: v.nullable(IssueCursor),
  version: Count,
};

/** Counted for the first page only; a later page leaves the counts it was opened with in place. */
const FirstPageCounts = v.nullable(IssueStatusCounts);

const IssueTarget = v.object({ issueId: Uuid });

export const IssueSupporter = v.object({
  uid: v.string(),
  displayName: v.string(),
  photoUrl: v.nullable(v.string()),
  isAuthor: v.boolean(),
});
export type IssueSupporter = v.InferOutput<typeof IssueSupporter>;

const SupportAnswer = v.object({ supported: v.boolean(), supportCount: Count, goalMet: v.boolean() });

export const ISSUE_ACTIONS = {
  listIssues: action({
    group: "read",
    input: v.object({ category: RequiredText, ...IssuePaging }),
    output: v.object({ ...IssuePage, statusCounts: FirstPageCounts }),
  }),
  searchIssues: action({
    group: "read",
    input: v.object({ category: RequiredText, query: RequiredText, ...IssuePaging }),
    output: v.object(IssuePage),
  }),
  /** The reader's own proposals, across categories. */
  listUserIssues: action({
    group: "read",
    input: v.object({ query: OptionalText, ...IssuePaging }),
    output: v.object({ ...IssuePage, statusCounts: FirstPageCounts }),
  }),
  getIssue: action({
    group: "read",
    input: IssueTarget,
    output: v.object({ issue: Issue, canDeleteIssue: v.boolean() }),
  }),
  listIssueSupporters: action({
    group: "read",
    input: IssueTarget,
    output: v.object({ supporters: v.array(IssueSupporter) }),
  }),
  createIssue: action({
    group: "sensitive-write",
    extraLimit: "issueCreateDaily",
    input: v.object({ category: RequiredText, title: RequiredText, content: RequiredText }),
    output: v.object({ issue: Issue }),
  }),
  moderateIssueStatus: action({
    group: "admin-write",
    extraLimit: "moderationWriteHourly",
    input: v.object({
      issueId: Uuid,
      status: v.picklist(ISSUE_STATUSES, "invalid-status"),
      /** Why a proposal under review was turned down. */
      reason: OptionalText,
      /** Required when the proposal is closed as completed or infeasible. */
      resultContent: OptionalText,
    }),
    output: v.object({ issue: Issue }),
  }),
  toggleSupport: action({
    group: "sensitive-write",
    extraLimit: "supportToggleHourly",
    input: IssueTarget,
    output: SupportAnswer,
  }),
  removeSupport: action({
    group: "sensitive-write",
    extraLimit: "supportToggleHourly",
    input: IssueTarget,
    output: SupportAnswer,
  }),
  deleteIssue: action({
    group: "admin-write",
    extraLimit: "destructiveWriteHourly",
    input: IssueTarget,
    output: Success,
  }),
  listComments: action({
    group: "read",
    input: v.object({ issueId: Uuid, ...CommentPaging }),
    output: CommentPage,
  }),
  createComment: action({
    group: "sensitive-write",
    extraLimit: "commentCreateHourly",
    input: v.object({ issueId: Uuid, ...NewComment }),
    output: v.object({ comment: Comment }),
  }),
  deleteComment: action({
    group: "sensitive-write",
    extraLimit: "destructiveWriteHourly",
    input: v.object({ commentId: Uuid }),
    output: Success,
  }),
};
