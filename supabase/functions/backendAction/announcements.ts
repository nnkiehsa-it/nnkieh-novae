import { handleAnnouncementCommentAction, isAnnouncementCommentAction } from "./announcement-comments.ts";
import { handleAnnouncementReadAction, isAnnouncementReadAction } from "./announcement-read.ts";
import { handleAnnouncementWriteAction, isAnnouncementWriteAction } from "./announcement-write.ts";
import type { AuthContext, BackendSupabase, JsonRecord } from "./types.ts";

export function isAnnouncementAction(action: string) {
  return isAnnouncementReadAction(action)
    || isAnnouncementWriteAction(action)
    || isAnnouncementCommentAction(action);
}

export async function handleAnnouncementAction(
  action: string,
  payload: JsonRecord,
  auth: AuthContext,
  supabase: BackendSupabase,
) {
  if (isAnnouncementReadAction(action)) return handleAnnouncementReadAction(action, payload, auth, supabase);
  if (isAnnouncementWriteAction(action)) return handleAnnouncementWriteAction(action, payload, auth, supabase);
  if (isAnnouncementCommentAction(action)) return handleAnnouncementCommentAction(action, payload, auth, supabase);
  throw new Error("unsupported-action");
}
