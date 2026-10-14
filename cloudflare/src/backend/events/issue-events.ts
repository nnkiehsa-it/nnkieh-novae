import type { Announcers, ResolvedDomainEvent } from "./domain-events.ts";

function resultUpdated(issueId: string, content: string | null): ResolvedDomainEvent {
  return {
    aggregateType: "issue", aggregateId: issueId, eventType: "issue.result_updated",
    destinations: ["notion", "realtime"],
    payload: { issue_id: issueId, result_content: content ?? "" },
  };
}

/** What a proposal, its support and its comments announce. */
export const ISSUE_ANNOUNCERS = {
  createIssue: ({ result: { issue }, actorUid }) => [{
    aggregateType: "issue",
    aggregateId: issue.id,
    eventType: "issue.created",
    destinations: ["notion", "in_app", "push", "realtime"],
    payload: {
      issue_id: issue.id,
      title: issue.title,
      category: issue.category,
      author_uid: actorUid,
      read_access: issue.readAccess,
    },
  }],
  moderateIssueStatus: ({ result: { issue, previousStatus, resultChanged } }) => [
    ...(previousStatus === issue.status ? [] : [{
      aggregateType: "issue",
      aggregateId: issue.id,
      eventType: "issue.status_changed",
      destinations: ["notion", "in_app", "push", "realtime"],
      payload: {
        issue_id: issue.id,
        new_status: issue.status,
        old_status: previousStatus,
        author_uid: issue.authorUid,
        title: issue.title,
        issue_category: issue.category,
        read_access: issue.readAccess,
      },
    } satisfies ResolvedDomainEvent]),
    ...(resultChanged ? [resultUpdated(issue.id, issue.resultContent)] : []),
  ],
  updateIssueResult: ({ input }) => [resultUpdated(input.issueId, input.resultContent)],
  toggleSupport: ({ input, result, actorUid }) => [result.goalMet
    ? {
      aggregateType: "issue",
      aggregateId: input.issueId,
      eventType: "support.goal_met",
      destinations: ["notion", "in_app", "push", "realtime"],
      payload: { issue_id: input.issueId, supporter_uid: actorUid, title: result.title, issue_category: result.category },
    }
    : {
      aggregateType: "issue",
      aggregateId: input.issueId,
      eventType: "support.toggled",
      destinations: ["notion", "realtime"],
      payload: { issue_id: input.issueId, supporter_uid: actorUid, supported: result.supported, support_count: result.supportCount },
    }],
  removeSupport: ({ input, result, actorUid }) => [{
    aggregateType: "issue",
    aggregateId: input.issueId,
    eventType: "support.toggled",
    destinations: ["notion", "realtime"],
    payload: { issue_id: input.issueId, supporter_uid: actorUid, supported: false, support_count: result.supportCount },
  }],
  deleteIssue: ({ input, result }) => [{
    aggregateType: "issue",
    aggregateId: input.issueId,
    eventType: "issue.deleted",
    destinations: ["notion", "in_app", "push", "realtime"],
    payload: {
      issue_id: input.issueId,
      author_uid: result.authorUid,
      issue_category: result.issueCategory,
      supporter_uids: result.supporterUids,
      title: result.title,
      new_status: result.status,
      read_access: result.readAccess,
    },
  }],
  createComment: ({ input, result: { comment, issueCategory }, actorUid }) => [{
    aggregateType: "issue",
    aggregateId: input.issueId,
    eventType: "issue.comment_created",
    destinations: ["notion", "in_app", "push", "realtime"],
    payload: {
      comment_id: comment.id,
      issue_id: input.issueId,
      parent_comment_id: comment.parentCommentId ?? "",
      content: comment.content,
      author_uid: actorUid,
      issue_category: issueCategory,
    },
  }],
  deleteComment: ({ input, result }) => [{
    aggregateType: "issue",
    aggregateId: result.issueId,
    eventType: "issue.comment_deleted",
    destinations: ["notion", "realtime"],
    payload: { comment_id: input.commentId, issue_id: result.issueId },
  }],
} satisfies Partial<Announcers>;
