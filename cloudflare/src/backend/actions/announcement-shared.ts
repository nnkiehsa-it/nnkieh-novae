import type { JsonRecord } from "./types.ts";
import { toMs } from "./utils.ts";

export function announcementToResponse(announcement: JsonRecord, liked = false) {
  return {
    ...announcement,
    currentUserLiked: liked,
    published_at_ms: toMs(announcement.published_at),
  };
}
