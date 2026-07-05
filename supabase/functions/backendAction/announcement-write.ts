import { asString } from "../_shared/http.ts";
import { RATE_LIMITS } from "../_shared/rate-limits.ts";
import { claimFixedWindowRateLimit } from "../_shared/upstash-rate-limit.ts";
import { requireAdmin } from "./auth.ts";
import { announcementToResponse } from "./announcement-shared.ts";
import type { AuthContext, BackendSupabase, JsonRecord } from "./types.ts";
import { markMarkdownUploadsAttached, queueAttachedUploadsForDeletion, queueUploadIdsForDeletion } from "./uploads.ts";
import { asBoolean, utcHourWindow } from "./utils.ts";
import { INPUT_LIMITS, requiredText } from "./validation.ts";

async function createAnnouncement(payload: JsonRecord, auth: AuthContext, supabase: BackendSupabase) {
  requireAdmin(auth);
  const content = requiredText(payload.content, "content", INPUT_LIMITS.content);
  const { data, error } = await supabase.schema("app_private").from("announcements").insert({
    author_uid: auth.uid,
    author_name: auth.name || "管理員",
    author_photo_url: auth.photoUrl,
    title: requiredText(payload.title, "title", INPUT_LIMITS.title),
    content,
  }).select("*").single();
  if (error) throw error;
  await markMarkdownUploadsAttached(supabase, auth.uid, content, "announcement", data.id);
  await supabase.schema("app_private").from("outbox_events").insert({
    event_type: "announcement.created",
    target_type: "announcement",
    target_id: data.id,
    actor_uid: auth.uid,
    payload: { author_name: data.author_name, content: data.content, title: data.title },
  });
  return { announcement: announcementToResponse(data as JsonRecord) };
}

async function updateAnnouncement(payload: JsonRecord, auth: AuthContext, supabase: BackendSupabase) {
  requireAdmin(auth);
  const announcementId = asString(payload.announcementId);
  const { data: previouslyAttached, error: previousUploadsError } = await supabase.schema("app_private")
    .from("uploads").select("id").eq("attached_target_type", "announcement").eq("attached_target_id", announcementId);
  if (previousUploadsError) throw previousUploadsError;
  const content = requiredText(payload.content, "content", INPUT_LIMITS.content);
  const { data, error } = await supabase.schema("app_private").from("announcements").update({
    title: requiredText(payload.title, "title", INPUT_LIMITS.title),
    content,
  }).eq("id", announcementId).select("*").single();
  if (error) throw error;
  await markMarkdownUploadsAttached(supabase, auth.uid, content, "announcement", data.id);
  const retainedUploadIds = new Set(
    [...content.matchAll(/srp-upload:\/\/([0-9a-fA-F-]{36})/gu)].map((match) => match[1]),
  );
  const removedUploads = (previouslyAttached ?? []).filter((upload) => !retainedUploadIds.has(upload.id));
  if (removedUploads.length > 0) {
    await queueUploadIdsForDeletion(supabase, removedUploads.map((upload) => upload.id));
  }
  await supabase.schema("app_private").from("outbox_events").insert({
    event_type: "announcement.updated",
    target_type: "announcement",
    target_id: data.id,
    actor_uid: auth.uid,
    payload: { author_name: data.author_name, content: data.content, title: data.title },
  });
  return { announcement: announcementToResponse(data as JsonRecord) };
}

async function deleteAnnouncement(payload: JsonRecord, auth: AuthContext, supabase: BackendSupabase) {
  requireAdmin(auth);
  const announcementId = asString(payload.announcementId);
  const { data: comments, error: commentsError } = await supabase.schema("app_private")
    .from("announcement_comments").select("id").eq("announcement_id", announcementId);
  if (commentsError) throw commentsError;
  await queueAttachedUploadsForDeletion(supabase, [
    { id: announcementId, type: "announcement" },
    ...(comments ?? []).map((comment) => ({ id: comment.id, type: "announcement_comment" as const })),
  ]);
  await supabase.schema("app_private").from("outbox_events").insert({
    event_type: "announcement.deleted",
    target_type: "announcement",
    target_id: announcementId,
    actor_uid: auth.uid,
    payload: { announcement_id: announcementId },
  });
  const { error } = await supabase.schema("app_private").from("announcements").delete().eq("id", announcementId);
  if (error) throw error;
  return { success: true };
}

async function setAnnouncementLike(payload: JsonRecord, auth: AuthContext, supabase: BackendSupabase) {
  await claimFixedWindowRateLimit(auth.uid, "announcement.like", utcHourWindow(), RATE_LIMITS.announcementLikeHourly);
  const announcementId = asString(payload.announcementId);
  const liked = asBoolean(payload.liked);
  if (liked) {
    await supabase.schema("app_private").from("announcement_likes").upsert({ announcement_id: announcementId, uid: auth.uid });
  } else {
    await supabase.schema("app_private").from("announcement_likes").delete().eq("announcement_id", announcementId).eq("uid", auth.uid);
  }
  const { data: announcement, error } = await supabase.schema("app_private").from("announcements").select("like_count").eq("id", announcementId).single();
  if (error) throw error;
  return { liked, like_count: announcement.like_count ?? 0 };
}

export function isAnnouncementWriteAction(action: string) {
  return action === "createAnnouncement"
    || action === "updateAnnouncement"
    || action === "deleteAnnouncement"
    || action === "setAnnouncementLike";
}

export async function handleAnnouncementWriteAction(
  action: string,
  payload: JsonRecord,
  auth: AuthContext,
  supabase: BackendSupabase,
) {
  if (action === "createAnnouncement") return createAnnouncement(payload, auth, supabase);
  if (action === "updateAnnouncement") return updateAnnouncement(payload, auth, supabase);
  if (action === "deleteAnnouncement") return deleteAnnouncement(payload, auth, supabase);
  if (action === "setAnnouncementLike") return setAnnouncementLike(payload, auth, supabase);
  throw new Error("unsupported-action");
}
