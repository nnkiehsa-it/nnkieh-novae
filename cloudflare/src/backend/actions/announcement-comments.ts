import * as v from "valibot";
import type { ActionInput } from "../../../../shared/actions.ts";
import { Count } from "../../../../shared/contract.ts";
import { Comment, CommentPage } from "../../../../shared/contracts/discussions.ts";
import type { AuthContext, BackendDatabase } from "./types.ts";
import { hasPermission } from "./auth.ts";
import { validateMarkdownUploadsBeforeCreate } from "./upload-markdown.ts";
import { INPUT_LIMITS, requiredMediaContent } from "./validation.ts";
import { loadContentVersion } from "./content-versions.ts";
import type { Selected } from "../database/schema.ts";

const StoredCommentPage = v.omit(CommentPage, ["version"]);

export async function listAnnouncementComments(input: ActionInput<"listAnnouncementComments">, _auth: AuthContext, database: BackendDatabase) {
  const [version, page] = await Promise.all([
    loadContentVersion(database, "announcements"),
    database.call("app_api", "backend_list_announcement_comments", {
      announcement_id: input.announcementId,
      cursor_id: input.cursor?.id ?? null,
      cursor_created_at: input.cursor?.createdAt ?? null,
      page_size: input.pageSize,
      sort_name: input.sort,
    }),
  ]);
  return { ...v.parse(StoredCommentPage, page), version };
}

export async function createAnnouncementComment(input: ActionInput<"createAnnouncementComment">, auth: AuthContext, database: BackendDatabase) {
  const [announcement, setup] = await Promise.all([
    database.sqlMaybe<Selected<"announcements", "comments_enabled">>`
      select comments_enabled from app_private.announcements where id = ${input.announcementId}`,
    database.sqlOne<Selected<"system_setup", "announcement_comments_enabled">>`
      select announcement_comments_enabled from app_private.system_setup where singleton = true`,
  ]);
  if (!announcement) throw new Error("not-found");
  if (!announcement.comments_enabled || !setup.announcement_comments_enabled) throw new Error("comments-disabled");
  const content = requiredMediaContent(input.content, "comment", INPUT_LIMITS.comment, INPUT_LIMITS.commentStorage);
  await validateMarkdownUploadsBeforeCreate(database, auth.uid, content, "announcement_comment", input.announcementId);
  return v.parse(v.object({ comment: Comment, commentCount: Count }), await database.call("app_api", "backend_create_announcement_comment", {
    announcement_id: input.announcementId,
    parent_comment_id: input.parentCommentId,
    actor_uid: auth.uid,
    comment_content: content,
  }));
}

export async function deleteAnnouncementComment(input: ActionInput<"deleteAnnouncementComment">, auth: AuthContext, database: BackendDatabase) {
  return v.parse(
    v.object({ announcementId: v.string(), commentCount: Count }),
    await database.call("app_api", "backend_delete_announcement_comment", {
      comment_id: input.commentId,
      actor_uid: auth.uid,
      actor_is_admin: hasPermission(auth, "announcement.manage"),
    }),
  );
}
