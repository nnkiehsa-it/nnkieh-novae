import { asRecord } from "../_shared/http.ts";
import { requirePermission } from "./auth.ts";
import type { AuthContext, BackendSupabase, JsonRecord } from "./types.ts";
import {
  validateMarkdownUploadsBeforeCreate,
} from "./uploads.ts";
import { asBoolean, asUuid } from "./utils.ts";
import { INPUT_LIMITS, requiredMediaContent, requiredText } from "./validation.ts";

async function createAnnouncement(payload: JsonRecord, auth: AuthContext, supabase: BackendSupabase) {
  requirePermission(auth, "announcement.manage");
  const content = requiredMediaContent(
    payload.content,
    "content",
    INPUT_LIMITS.content,
    INPUT_LIMITS.contentStorage,
  );
  await validateMarkdownUploadsBeforeCreate(supabase, auth.uid, content, "announcement");
  const { data, error } = await supabase.schema("app_api").rpc("backend_create_announcement", {
    actor_uid: auth.uid,
    announcement_title: requiredText(payload.title, "title", INPUT_LIMITS.title),
    announcement_content: content,
  });
  if (error) throw error;
  const announcement = asRecord(data);
  return { announcement };
}

async function deleteAnnouncement(payload: JsonRecord, auth: AuthContext, supabase: BackendSupabase) {
  requirePermission(auth, "announcement.manage");
  const announcementId = asUuid(payload.announcementId);
  if (!announcementId) throw new Error("not-found");
  const { error } = await supabase.schema("app_api").rpc("backend_delete_announcement", {
    announcement_id: announcementId,
  });
  if (error) throw error;
  return { success: true };
}

async function setAnnouncementLike(payload: JsonRecord, auth: AuthContext, supabase: BackendSupabase) {
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
  if (action === "deleteAnnouncement") return deleteAnnouncement(payload, auth, supabase);
  if (action === "setAnnouncementLike") return setAnnouncementLike(payload, auth, supabase);
  throw new Error("invalid-action");
}
