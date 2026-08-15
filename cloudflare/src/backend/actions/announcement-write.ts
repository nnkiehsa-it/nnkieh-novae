import { asRecord } from "../shared/http.ts";
import { requirePermission } from "./auth.ts";
import type { AuthContext, BackendDatabase, JsonRecord } from "./types.ts";
import {
  validateMarkdownUploadsBeforeCreate,
} from "./uploads.ts";
import { asBoolean, asUuid } from "./utils.ts";
import { INPUT_LIMITS, requiredMediaContent, requiredText } from "./validation.ts";

async function createAnnouncement(payload: JsonRecord, auth: AuthContext, database: BackendDatabase) {
  requirePermission(auth, "announcement.manage");
  const content = requiredMediaContent(
    payload.content,
    "content",
    INPUT_LIMITS.content,
    INPUT_LIMITS.contentStorage,
  );
  await validateMarkdownUploadsBeforeCreate(database, auth.uid, content, "announcement");
  const { data, error } = await database.call("app_api", "backend_create_announcement", {
    actor_uid: auth.uid,
    announcement_title: requiredText(payload.title, "title", INPUT_LIMITS.title),
    announcement_content: content,
  });
  if (error) throw error;
  const announcement = asRecord(data);
  return { announcement };
}

async function deleteAnnouncement(payload: JsonRecord, auth: AuthContext, database: BackendDatabase) {
  requirePermission(auth, "announcement.manage");
  const announcementId = asUuid(payload.announcementId);
  if (!announcementId) throw new Error("not-found");
  const { error } = await database.call("app_api", "backend_delete_announcement", {
    announcement_id: announcementId,
  });
  if (error) throw error;
  return { success: true };
}

async function setAnnouncementLike(payload: JsonRecord, auth: AuthContext, database: BackendDatabase) {
  const announcementId = asUuid(payload.announcementId);
  if (!announcementId) throw new Error("not-found");
  const liked = asBoolean(payload.liked);
  const { data, error } = await database.call("app_api", "backend_set_announcement_like", {
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
  database: BackendDatabase,
) {
  if (action === "createAnnouncement") return createAnnouncement(payload, auth, database);
  if (action === "deleteAnnouncement") return deleteAnnouncement(payload, auth, database);
  if (action === "setAnnouncementLike") return setAnnouncementLike(payload, auth, database);
  throw new Error("invalid-action");
}
