import type { AuthContext, BackendDatabase, JsonRecord } from "./types.ts";
import { asRecord } from "../shared/http.ts";
import { asNumber, asUuid, readCursor, readCursorDate } from "./utils.ts";

function compactAnnouncementListResult(data: unknown): JsonRecord {
  const result = asRecord(data);
  if (!Array.isArray(result.announcements)) return result;
  return {
    ...result,
    announcements: result.announcements.map((value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return value;
      const announcement = { ...(value as JsonRecord) };
      delete announcement.content;
      return announcement;
    }),
  };
}

async function listAnnouncements(payload: JsonRecord, auth: AuthContext, database: BackendDatabase) {
  const pageSize = Math.min(Math.max(Math.round(asNumber(payload.pageSize, 30)), 1), 50);
  const cursor = readCursor(payload);
  const { data, error } = await database.call("app_api", "backend_list_announcements_snapshot", {
    actor_uid: auth.uid,
    page_size: pageSize,
    cursor_id: asUuid(cursor.id) || null,
    cursor_published_at: readCursorDate(cursor, "publishedAtMs", "published_at") || null,
  });
  if (error) throw error;
  return compactAnnouncementListResult(data);
}

async function getAnnouncement(payload: JsonRecord, auth: AuthContext, database: BackendDatabase) {
  const announcementId = asUuid(payload.announcementId);
  if (!announcementId) throw new Error("not-found");
  const { data, error } = await database.call("app_api", "backend_get_announcement", {
    announcement_id: announcementId,
    actor_uid: auth.uid,
  });
  if (error) throw error;
  return { announcement: data };
}

export function isAnnouncementReadAction(action: string) {
  return action === "listAnnouncements" || action === "getAnnouncement";
}

export async function handleAnnouncementReadAction(
  action: string,
  payload: JsonRecord,
  auth: AuthContext,
  database: BackendDatabase,
) {
  if (action === "listAnnouncements") return listAnnouncements(payload, auth, database);
  if (action === "getAnnouncement") return getAnnouncement(payload, auth, database);
  throw new Error("invalid-action");
}
