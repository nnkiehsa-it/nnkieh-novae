import * as v from "valibot";
import { action, Count, NoInput, NullableTimestamp, pageSize, RequiredText, Success, Timestamp, Uuid } from "../contract.ts";
import { Comment, CommentPage, CommentPaging, NewComment } from "./discussions.ts";

/** An announcement as the feed shows it. */
export const AnnouncementSummary = v.object({
  id: Uuid,
  title: v.string(),
  authorUid: v.string(),
  likeCount: Count,
  commentCount: Count,
  commentsEnabled: v.boolean(),
  /** Whether comments on announcements are switched on for the whole platform. */
  commentsGloballyEnabled: v.boolean(),
  currentUserLiked: v.boolean(),
  publishedAt: Timestamp,
});
export type AnnouncementSummary = v.InferOutput<typeof AnnouncementSummary>;

export const Announcement = v.object({ ...AnnouncementSummary.entries, content: v.string() });
export type Announcement = v.InferOutput<typeof Announcement>;

export const AnnouncementCursor = v.object({ id: Uuid, publishedAt: Timestamp });
export type AnnouncementCursor = v.InferOutput<typeof AnnouncementCursor>;

const AnnouncementTarget = v.object({ announcementId: Uuid });

export const ANNOUNCEMENT_ACTIONS = {
  listAnnouncements: action({
    group: "read",
    input: v.object({ cursor: v.optional(v.nullable(AnnouncementCursor), null), pageSize: pageSize(50, 10) }),
    output: v.object({
      announcements: v.array(AnnouncementSummary),
      hasMore: v.boolean(),
      cursor: v.nullable(AnnouncementCursor),
      /** The newest announcement at or after the cursor, for marking the feed opened. */
      snapshotAt: NullableTimestamp,
      version: Count,
    }),
  }),
  getAnnouncement: action({
    group: "read",
    input: AnnouncementTarget,
    output: v.object({ announcement: Announcement }),
  }),
  getAnnouncementUnreadHint: action({
    group: "read",
    input: NoInput,
    output: v.object({ hasUnread: v.boolean() }),
  }),
  markAnnouncementsOpened: action({
    group: "general-write",
    input: v.object({ openedThrough: Timestamp }),
    output: v.object({ ...Success.entries, openedAt: NullableTimestamp }),
  }),
  createAnnouncement: action({
    group: "admin-write",
    extraLimit: "announcementCreateDaily",
    input: v.object({ title: RequiredText, content: RequiredText }),
    output: v.object({ announcement: Announcement }),
  }),
  deleteAnnouncement: action({
    group: "admin-write",
    extraLimit: "destructiveWriteHourly",
    input: AnnouncementTarget,
    output: Success,
  }),
  setAnnouncementLike: action({
    group: "sensitive-write",
    extraLimit: "announcementLikeHourly",
    input: v.object({ announcementId: Uuid, liked: v.boolean() }),
    output: v.object({ liked: v.boolean(), likeCount: Count }),
  }),
  listAnnouncementComments: action({
    group: "read",
    input: v.object({ announcementId: Uuid, ...CommentPaging }),
    output: CommentPage,
  }),
  createAnnouncementComment: action({
    group: "sensitive-write",
    extraLimit: "commentCreateHourly",
    input: v.object({ announcementId: Uuid, ...NewComment }),
    output: v.object({ comment: Comment, commentCount: Count }),
  }),
  deleteAnnouncementComment: action({
    group: "sensitive-write",
    extraLimit: "destructiveWriteHourly",
    input: v.object({ commentId: Uuid }),
    output: v.object({ announcementId: Uuid, commentCount: Count }),
  }),
};
