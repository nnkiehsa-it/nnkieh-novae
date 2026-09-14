import type { ResolvedDomainEvent, WriteOutcome } from "./domain-events.ts";

/** What an announcement and its comments announce. */
export function announcementEvents(outcome: WriteOutcome): ResolvedDomainEvent[] | null {
  const { action, payload, actorUid, res, resAnnouncement, resComment } = outcome;
  const events: ResolvedDomainEvent[] = [];
  switch (action) {
    case "createAnnouncement": {
      const announcementId = String(resAnnouncement.id ?? res.id ?? "");
      events.push({
        aggregateType: "announcement",
        aggregateId: announcementId,
        eventType: "announcement.created",
        destinations: ["notion", "in_app", "push", "realtime"],
        payload: {
          announcement_id: announcementId,
          title: String(resAnnouncement.title ?? res.title ?? payload.title ?? ""),
          author_uid: actorUid,
        },
      });
      break;
    }
    case "deleteAnnouncement": {
      const announcementId = String(payload.announcementId ?? "");
      events.push({
        aggregateType: "announcement",
        aggregateId: announcementId,
        eventType: "announcement.deleted",
        destinations: ["notion", "realtime"],
        payload: { announcement_id: announcementId },
      });
      break;
    }
    case "setAnnouncementLike": {
      const announcementId = String(payload.announcementId ?? "");
      events.push({
        aggregateType: "announcement",
        aggregateId: announcementId,
        eventType: "announcement.liked",
        destinations: ["realtime"],
        payload: {
          announcement_id: announcementId,
          actor_uid: actorUid,
          liked: Boolean(payload.liked),
          like_count: Number(res.like_count ?? res.likeCount ?? 0),
        },
      });
      break;
    }
    case "createAnnouncementComment": {
      const commentId = String(resComment.id ?? res.id ?? "");
      const announcementId = String(payload.announcementId ?? "");
      events.push({
        aggregateType: "announcement",
        aggregateId: announcementId,
        eventType: "announcement.comment_created",
        destinations: ["notion", "in_app", "push", "realtime"],
        payload: {
          comment_id: commentId,
          announcement_id: announcementId,
          parent_comment_id: String(resComment.parent_comment_id ?? resComment.parentCommentId ?? payload.parentCommentId ?? ""),
          content: String(resComment.content ?? payload.content ?? ""),
          author_uid: actorUid,
        },
      });
      break;
    }
    case "deleteAnnouncementComment": {
      const commentId = String(payload.commentId ?? "");
      const announcementId = String(payload.announcementId ?? "");
      events.push({
        aggregateType: "announcement",
        aggregateId: announcementId,
        eventType: "announcement.comment_deleted",
        destinations: ["notion", "realtime"],
        payload: { comment_id: commentId, announcement_id: announcementId },
      });
      break;
    }
    default:
      return null;
  }
  return events;
}
