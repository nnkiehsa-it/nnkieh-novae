import { handleAnnouncementCommentAction, isAnnouncementCommentAction } from "./announcement-comments.ts";
import { handleAnnouncementReadAction, isAnnouncementReadAction } from "./announcement-read.ts";
import { handleAnnouncementWriteAction, isAnnouncementWriteAction } from "./announcement-write.ts";
import type { AuthContext, BackendDatabase, JsonRecord } from "./types.ts";
import { asString } from "../shared/json.ts";

export async function handleAnnouncementAction(
  action: string,
  payload: JsonRecord,
  auth: AuthContext,
  database: BackendDatabase,
) {
  if (isAnnouncementReadAction(action)) return handleAnnouncementReadAction(action, payload, auth, database);
  if (isAnnouncementWriteAction(action)) return handleAnnouncementWriteAction(action, payload, auth, database);
  if (isAnnouncementCommentAction(action)) return handleAnnouncementCommentAction(action, payload, auth, database);
  if (action === "markAnnouncementsOpened") {
    const openedThrough = asString(payload.openedThrough);
    if (!openedThrough || !Number.isFinite(Date.parse(openedThrough))) throw new Error("validation-invalid");
    const data = await database.call("app_api", "backend_mark_announcements_opened", {
      actor_uid: auth.uid,
      opened_through: openedThrough,
    });
    return data;
  }
  throw new Error("invalid-action");
}
