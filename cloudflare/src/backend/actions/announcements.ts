import { handleAnnouncementCommentAction, isAnnouncementCommentAction } from "./announcement-comments.ts";
import { handleAnnouncementReadAction, isAnnouncementReadAction } from "./announcement-read.ts";
import { handleAnnouncementWriteAction, isAnnouncementWriteAction } from "./announcement-write.ts";
import type { AuthContext, BackendDatabase, JsonRecord } from "./types.ts";

export function isAnnouncementAction(action: string) {
  return isAnnouncementReadAction(action)
    || isAnnouncementWriteAction(action)
    || isAnnouncementCommentAction(action);
}

export async function handleAnnouncementAction(
  action: string,
  payload: JsonRecord,
  auth: AuthContext,
  database: BackendDatabase,
) {
  if (isAnnouncementReadAction(action)) return handleAnnouncementReadAction(action, payload, auth, database);
  if (isAnnouncementWriteAction(action)) return handleAnnouncementWriteAction(action, payload, auth, database);
  if (isAnnouncementCommentAction(action)) return handleAnnouncementCommentAction(action, payload, auth, database);
  throw new Error("invalid-action");
}
