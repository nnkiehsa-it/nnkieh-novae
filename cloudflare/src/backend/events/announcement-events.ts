import type { Announcers } from "./domain-events.ts";

/** What an announcement and its comments announce. */
export const ANNOUNCEMENT_ANNOUNCERS = {
  createAnnouncement: ({ result: { announcement }, actorUid }) => [{
    aggregateType: "announcement",
    aggregateId: announcement.id,
    eventType: "announcement.created",
    destinations: ["notion", "in_app", "push", "realtime"],
    payload: { announcement_id: announcement.id, title: announcement.title, author_uid: actorUid },
  }],
  deleteAnnouncement: ({ input }) => [{
    aggregateType: "announcement",
    aggregateId: input.announcementId,
    eventType: "announcement.deleted",
    destinations: ["notion", "realtime"],
    payload: { announcement_id: input.announcementId },
  }],
  setAnnouncementLike: ({ input, result, actorUid }) => [{
    aggregateType: "announcement",
    aggregateId: input.announcementId,
    eventType: "announcement.liked",
    destinations: ["notion", "realtime"],
    payload: { announcement_id: input.announcementId, actor_uid: actorUid, liked: result.liked, like_count: result.likeCount },
  }],
  createAnnouncementComment: ({ input, result: { comment }, actorUid }) => [{
    aggregateType: "announcement",
    aggregateId: input.announcementId,
    eventType: "announcement.comment_created",
    destinations: ["notion", "in_app", "push", "realtime"],
    payload: {
      comment_id: comment.id,
      announcement_id: input.announcementId,
      parent_comment_id: comment.parentCommentId ?? "",
      content: comment.content,
      author_uid: actorUid,
    },
  }],
  deleteAnnouncementComment: ({ input, result }) => [{
    aggregateType: "announcement",
    aggregateId: result.announcementId,
    eventType: "announcement.comment_deleted",
    destinations: ["notion", "realtime"],
    payload: { comment_id: input.commentId, announcement_id: result.announcementId },
  }],
} satisfies Partial<Announcers>;
