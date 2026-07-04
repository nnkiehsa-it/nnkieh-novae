import { asString } from "../_shared/http.ts";
import { RATE_LIMITS } from "../_shared/rate-limits.ts";
import { claimFixedWindowRateLimit } from "../_shared/upstash-rate-limit.ts";
import { commentCursor, commentToResponse } from "./issue-shared.ts";
import type { AuthContext, BackendSupabase, JsonRecord } from "./types.ts";
import { applyAscendingDateCursor, asBoolean, readCursor, utcHourWindow } from "./utils.ts";

async function listAnnouncementComments(payload: JsonRecord, supabase: BackendSupabase) {
  const pageSize = 20;
  let query = supabase.schema("app_private").from("announcement_comments").select("*").eq("announcement_id", asString(payload.announcementId));
  query = applyAscendingDateCursor(query, readCursor(payload), "created_at");
  const { data, error } = await query.order("created_at", { ascending: true }).order("id", { ascending: true }).limit(pageSize + 1);
  if (error) throw error;
  const comments = (data ?? []).map((comment) => commentToResponse(comment as JsonRecord));
  const lastComment = comments[Math.min(pageSize - 1, comments.length - 1)];
  return {
    comments: comments.slice(0, pageSize),
    cursor: comments.length > pageSize && lastComment ? commentCursor(lastComment) : null,
    hasMore: comments.length > pageSize,
  };
}

async function createAnnouncementComment(payload: JsonRecord, auth: AuthContext, supabase: BackendSupabase) {
  await claimFixedWindowRateLimit(auth.uid, "comment.create", utcHourWindow(), RATE_LIMITS.commentCreateHourly);
  const announcementId = asString(payload.announcementId);
  const { data, error } = await supabase.schema("app_private").from("announcement_comments").insert({
    announcement_id: announcementId,
    author_uid: auth.uid,
    author_name: auth.name,
    author_photo_url: auth.photoUrl,
    content: asString(payload.content),
    is_admin_comment: asBoolean(payload.isAdminComment) && auth.isAdmin,
  }).select("*").single();
  if (error) throw error;
  const { data: announcement, error: announcementError } = await supabase.schema("app_private").from("announcements").select("comment_count,title").eq("id", announcementId).single();
  if (announcementError) throw announcementError;
  await supabase.schema("app_private").from("outbox_events").insert({
    event_type: "announcement.comment_created",
    target_type: "announcement",
    target_id: announcementId,
    actor_uid: auth.uid,
    payload: {
      announcement_id: announcementId,
      author_name: auth.name,
      author_photo_url: auth.photoUrl,
      author_uid: auth.uid,
      content: data.content,
      title: announcement.title,
    },
  });
  return { comment: commentToResponse(data as JsonRecord), comment_count: announcement.comment_count ?? 0 };
}

async function deleteAnnouncementComment(payload: JsonRecord, auth: AuthContext, supabase: BackendSupabase) {
  const commentId = asString(payload.commentId);
  const { data } = await supabase.schema("app_private").from("announcement_comments").select("*").eq("id", commentId).maybeSingle();
  if (data && data.author_uid !== auth.uid && !auth.isAdmin) throw new Error("permission-denied");
  const announcementId = data?.announcement_id ?? "";
  await supabase.schema("app_private").from("announcement_comments").delete().eq("id", commentId);
  const { data: announcement } = announcementId
    ? await supabase.schema("app_private").from("announcements").select("comment_count").eq("id", announcementId).single()
    : { data: null };
  return { success: true, announcement_id: announcementId, comment_count: announcement?.comment_count ?? 0 };
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
  supabase: BackendSupabase,
) {
  if (action === "listAnnouncementComments") return listAnnouncementComments(payload, supabase);
  if (action === "createAnnouncementComment") return createAnnouncementComment(payload, auth, supabase);
  if (action === "deleteAnnouncementComment") return deleteAnnouncementComment(payload, auth, supabase);
  throw new Error("unsupported-action");
}
