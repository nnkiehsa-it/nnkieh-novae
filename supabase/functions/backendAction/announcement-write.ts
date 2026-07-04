import { asString } from "../_shared/http.ts";
import { requireAdmin } from "./auth.ts";
import { announcementToResponse } from "./announcement-shared.ts";
import type { AuthContext, BackendSupabase, JsonRecord } from "./types.ts";
import { asBoolean } from "./utils.ts";

async function createAnnouncement(payload: JsonRecord, auth: AuthContext, supabase: BackendSupabase) {
  requireAdmin(auth);
  const { data, error } = await supabase.schema("app_private").from("announcements").insert({
    author_uid: auth.uid,
    author_name: auth.name || "管理員",
    author_photo_url: auth.photoUrl,
    title: asString(payload.title),
    content: asString(payload.content),
  }).select("*").single();
  if (error) throw error;
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
  const { data, error } = await supabase.schema("app_private").from("announcements").update({
    title: asString(payload.title),
    content: asString(payload.content),
  }).eq("id", asString(payload.announcementId)).select("*").single();
  if (error) throw error;
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
