import { asRecord } from "../_shared/http.ts";
import { RATE_LIMITS } from "../_shared/rate-limits.ts";
import { claimFixedWindowRateLimit } from "../_shared/upstash-rate-limit.ts";
import { requireAdmin } from "./auth.ts";
import type { AuthContext, BackendSupabase, JsonRecord } from "./types.ts";
import {
  validateMarkdownUploadsBeforeCreate,
  validateMarkdownUploadsBeforeUpdate,
} from "./uploads.ts";
import { asBoolean, asUuid, utcHourWindow } from "./utils.ts";
import { INPUT_LIMITS, requiredText } from "./validation.ts";

async function createAnnouncement(payload: JsonRecord, auth: AuthContext, supabase: BackendSupabase) {
  requireAdmin(auth);
  const content = requiredText(payload.content, "content", INPUT_LIMITS.content);
  await validateMarkdownUploadsBeforeCreate(supabase, auth.uid, content, "announcement");
  const { data, error } = await supabase.schema("app_api").rpc("backend_create_announcement", {
    actor_uid: auth.uid,
    actor_name: auth.name || "管理員",
    actor_photo_url: auth.photoUrl,
    announcement_title: requiredText(payload.title, "title", INPUT_LIMITS.title),
    announcement_content: content,
  });
  if (error) throw error;
  const announcement = asRecord(data);
  return { announcement };
}

async function updateAnnouncement(payload: JsonRecord, auth: AuthContext, supabase: BackendSupabase) {
  requireAdmin(auth);
  const announcementId = asUuid(payload.announcementId);
  if (!announcementId) throw new Error("not-found");
  const content = requiredText(payload.content, "content", INPUT_LIMITS.content);
  await validateMarkdownUploadsBeforeUpdate(supabase, auth.uid, content, "announcement", announcementId);
  const { data, error } = await supabase.schema("app_api").rpc("backend_update_announcement", {
    announcement_id: announcementId,
    actor_uid: auth.uid,
    announcement_title: requiredText(payload.title, "title", INPUT_LIMITS.title),
    announcement_content: content,
  });
  if (error) throw error;
  const result = asRecord(data);
  const announcement = asRecord(result.announcement);
  return { announcement };
}

async function deleteAnnouncement(payload: JsonRecord, auth: AuthContext, supabase: BackendSupabase) {
  requireAdmin(auth);
  const announcementId = asUuid(payload.announcementId);
  if (!announcementId) throw new Error("not-found");
  const { error } = await supabase.schema("app_api").rpc("backend_delete_announcement", {
    announcement_id: announcementId,
  });
  if (error) throw error;
  return { success: true };
}

async function setAnnouncementLike(payload: JsonRecord, auth: AuthContext, supabase: BackendSupabase) {
  await claimFixedWindowRateLimit(auth.uid, "announcement.like", utcHourWindow(), RATE_LIMITS.announcementLikeHourly);
  const announcementId = asUuid(payload.announcementId);
  if (!announcementId) throw new Error("not-found");
  const liked = asBoolean(payload.liked);
  const { data, error } = await supabase.schema("app_api").rpc("backend_set_announcement_like", {
    announcement_id: announcementId,
    actor_uid: auth.uid,
    liked,
  });
  if (error) throw error;
  return data;
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
