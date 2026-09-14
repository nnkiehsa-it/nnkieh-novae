import type { ResolvedDomainEvent, WriteOutcome } from "./domain-events.ts";

/** What a proposal, its support and its comments announce. */
export function issueEvents(outcome: WriteOutcome): ResolvedDomainEvent[] | null {
  const { action, payload, actorUid, res, resIssue, resComment } = outcome;
  const events: ResolvedDomainEvent[] = [];
  switch (action) {
    case "createIssue": {
      const issueId = String(resIssue.id ?? res.id ?? payload.id ?? "");
      events.push({
        aggregateType: "issue",
        aggregateId: issueId,
        eventType: "issue.created",
        destinations: ["notion", "in_app", "push", "realtime"],
        payload: {
          issue_id: issueId,
          title: String(resIssue.title ?? res.title ?? payload.title ?? ""),
          category: String(resIssue.category ?? res.category ?? payload.category ?? ""),
          author_uid: actorUid,
          read_access: String(resIssue.readAccess ?? "owner-admin"),
        },
      });
      break;
    }
    case "moderateIssueStatus": {
      const issueId = String(payload.issueId ?? "");
      events.push({
        aggregateType: "issue",
        aggregateId: issueId,
        eventType: "issue.status_changed",
        destinations: ["notion", "in_app", "push", "realtime"],
        payload: {
          issue_id: issueId,
          new_status: String(resIssue.status ?? payload.status ?? ""),
          old_status: String(res.previousStatus ?? ""),
          author_uid: String(resIssue.authorUid ?? ""),
          title: String(resIssue.title ?? ""),
          issue_category: String(resIssue.category ?? ""),
          read_access: String(resIssue.readAccess ?? "owner-admin"),
        },
      });
      break;
    }
    case "updateIssueResult": {
      const issueId = String(payload.issueId ?? "");
      events.push({
        aggregateType: "issue",
        aggregateId: issueId,
        eventType: "issue.result_updated",
        destinations: ["notion", "realtime"],
        payload: {
          issue_id: issueId,
          result_content: String(payload.resultContent ?? ""),
        },
      });
      break;
    }
    case "toggleSupport": {
      const issueId = String(payload.issueId ?? "");
      const goalMet = Boolean(res.goal_met);
      if (goalMet) {
        events.push({
          aggregateType: "issue",
          aggregateId: issueId,
          eventType: "support.goal_met",
          destinations: ["notion", "in_app", "push", "realtime"],
          payload: {
            issue_id: issueId,
            supporter_uid: actorUid,
            title: String(res.title ?? ""),
            issue_category: String(res.issue_category ?? ""),
          },
        });
      } else {
        events.push({
          aggregateType: "issue",
          aggregateId: issueId,
          eventType: "support.toggled",
          destinations: ["notion", "realtime"],
          payload: {
            issue_id: issueId,
            supporter_uid: actorUid,
            supported: Boolean(res.supported),
            support_count: Number(res.support_count ?? res.supportCount ?? 0),
          },
        });
      }
      break;
    }
    case "removeSupport": {
      const issueId = String(payload.issueId ?? "");
      events.push({
        aggregateType: "issue",
        aggregateId: issueId,
        eventType: "support.toggled",
        destinations: ["realtime"],
        payload: { issue_id: issueId, supporter_uid: actorUid, supported: false },
      });
      break;
    }
    case "deleteIssue": {
      const issueId = String(payload.issueId ?? "");
      events.push({
        aggregateType: "issue",
        aggregateId: issueId,
        eventType: "issue.deleted",
        destinations: ["notion", "in_app", "push", "realtime"],
        payload: {
          issue_id: issueId,
          author_uid: String(res.authorUid ?? ""),
          issue_category: String(res.issueCategory ?? ""),
          supporter_uids: Array.isArray(res.supporterUids) ? res.supporterUids : [],
          title: String(res.title ?? ""),
          new_status: String(res.status ?? ""),
          read_access: String(res.readAccess ?? "owner-admin"),
        },
      });
      break;
    }
    case "createComment": {
      const commentId = String(resComment.id ?? res.id ?? "");
      const issueId = String(payload.issueId ?? "");
      events.push({
        aggregateType: "issue",
        aggregateId: issueId,
        eventType: "issue.comment_created",
        destinations: ["notion", "in_app", "push", "realtime"],
        payload: {
          comment_id: commentId,
          issue_id: issueId,
          parent_comment_id: String(resComment.parent_comment_id ?? resComment.parentCommentId ?? payload.parentCommentId ?? ""),
          content: String(resComment.content ?? payload.content ?? ""),
          author_uid: actorUid,
          issue_category: String(res.issueCategory ?? ""),
        },
      });
      break;
    }
    case "deleteComment": {
      const commentId = String(payload.commentId ?? "");
      const issueId = String(payload.issueId ?? "");
      events.push({
        aggregateType: "issue",
        aggregateId: issueId,
        eventType: "issue.comment_deleted",
        destinations: ["notion", "realtime"],
        payload: { comment_id: commentId, issue_id: issueId },
      });
      break;
    }
    default:
      return null;
  }
  return events;
}
