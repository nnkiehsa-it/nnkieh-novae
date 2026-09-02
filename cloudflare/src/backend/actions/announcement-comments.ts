import { asRecord, asString } from "../shared/http.ts";
import type { AuthContext, BackendDatabase, JsonRecord } from "./types.ts";
import { hasPermission } from "./auth.ts";
import { validateMarkdownUploadsBeforeCreate } from "./uploads.ts";
import { asNumber, asUuid, readCursor, readCursorDate } from "./utils.ts";
import { INPUT_LIMITS, requiredMediaContent } from "./validation.ts";
import { attachContentVersion, loadContentVersion } from "./content-versions.ts";

async function listAnnouncementComments(payload: JsonRecord, database: BackendDatabase) {
  const announcementId = asUuid(payload.announcementId);
  if (!announcementId) throw new Error("not-found");
  const cursor = readCursor(payload);
  const version = await loadContentVersion(database, "announcements");
  const sortName = asString(payload.sort) === "oldest" ? "oldest" : "newest";
  const { data, error } = await database.call("app_api", "backend_list_announcement_comments", {
    announcement_id: announcementId,
    cursor_id: asUuid(cursor.id) || null,
    cursor_created_at: readCursorDate(cursor, "createdAt") || null,
    page_size: Math.min(Math.max(Math.round(asNumber(payload.pageSize, 30)), 1), 30),
    sort_name: sortName,
  });
  if (error) throw error;
  return attachContentVersion(data, version);
}

async function createAnnouncementComment(payload: JsonRecord, auth: AuthContext, database: BackendDatabase) {
  const announcementId = asUuid(payload.announcementId);
  if (!announcementId) throw new Error("not-found");
  const [{ data: announcement, error: announcementError }, { data: setup, error: setupError }] = await Promise.all([
    database.table("app_private", "announcements")
      .select("comments_enabled").eq("id", announcementId).maybeSingle(),
    database.table("app_private", "system_setup")
      .select("announcement_comments_enabled").eq("singleton", true).single(),
  ]);
  if (announcementError) throw announcementError;
  if (setupError) throw setupError;
  if (!announcement) throw new Error("not-found");
  if (announcement.comments_enabled === false || setup.announcement_comments_enabled === false) {
    throw new Error("comments-disabled");
  }
  const content = requiredMediaContent(
    payload.content,
    "comment",
    INPUT_LIMITS.comment,
    INPUT_LIMITS.commentStorage,
  );
  const parentCommentId = asUuid(payload.parentCommentId) || null;
  await validateMarkdownUploadsBeforeCreate(database, auth.uid, content, "announcement_comment");
  const { data, error } = await database.call("app_api", "backend_create_announcement_comment", {
    announcement_id: announcementId,
    parent_comment_id: parentCommentId,
    actor_uid: auth.uid,
    comment_content: content,
  });
  if (error) throw error;
  const result = asRecord(data);
  const comment = asRecord(result.comment);
  return { comment, comment_count: result.comment_count };
}

async function deleteAnnouncementComment(payload: JsonRecord, auth: AuthContext, database: BackendDatabase) {
  const commentId = asUuid(payload.commentId);
  if (!commentId) return { success: true, announcement_id: "", comment_count: 0 };
  const { data, error } = await database.call("app_api", "backend_delete_announcement_comment", {
    comment_id: commentId,
    actor_uid: auth.uid,
    actor_is_admin: hasPermission(auth, "announcement.manage"),
  });
  if (error) throw error;
  const result = asRecord(data);
  return {
    success: true,
    announcement_id: asString(result.announcement_id),
    comment_count: typeof result.comment_count === "number" ? result.comment_count : 0,
  };
}

export function isAnnouncementCommentAction(action: string) {
  return action === "listAnnouncementComments"
    || action === "createAnnouncementComment"
    || action === "deleteAnnouncementComment";
}

export async function handleAnnouncementCommentAction(
  action: string,
  payload: JsonRecord,
  auth: AuthContext,
  database: BackendDatabase,
) {
  if (action === "listAnnouncementComments") return listAnnouncementComments(payload, database);
  if (action === "createAnnouncementComment") return createAnnouncementComment(payload, auth, database);
  if (action === "deleteAnnouncementComment") return deleteAnnouncementComment(payload, auth, database);
  throw new Error("invalid-action");
}
