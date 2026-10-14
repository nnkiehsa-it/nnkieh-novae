import * as v from "valibot";
import { Count, pageSize, RequiredText, Timestamp, Uuid } from "../contract.ts";

export const CommentSort = v.picklist(["newest", "oldest"]);
export type CommentSort = v.InferOutput<typeof CommentSort>;

const CommentFields = {
  id: Uuid,
  parentCommentId: v.nullable(Uuid),
  authorUid: v.string(),
  content: v.string(),
  createdAt: Timestamp,
};

/** A reply; replies are one level deep, so a reply has none of its own. */
export const Reply = v.object(CommentFields);
export type Reply = v.InferOutput<typeof Reply>;

/** A comment on a proposal or an announcement, with its replies oldest first. */
export const Comment = v.object({ ...CommentFields, replies: v.array(Reply) });
export type Comment = v.InferOutput<typeof Comment>;

export const CommentCursor = v.object({ id: Uuid, createdAt: Timestamp });
export type CommentCursor = v.InferOutput<typeof CommentCursor>;

/** The paging every comment list takes. */
export const CommentPaging = {
  sort: v.optional(CommentSort, "newest"),
  cursor: v.optional(v.nullable(CommentCursor), null),
  pageSize: pageSize(30, 30),
};

export const CommentPage = v.object({
  comments: v.array(Comment),
  hasMore: v.boolean(),
  cursor: v.nullable(CommentCursor),
  version: Count,
});
export type CommentPage = v.InferOutput<typeof CommentPage>;

/** A new comment, or a reply when it names the comment it answers. */
export const NewComment = {
  content: RequiredText,
  parentCommentId: v.optional(v.nullable(Uuid), null),
};
