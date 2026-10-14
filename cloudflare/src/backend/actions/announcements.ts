import * as v from "valibot";
import type { ActionInput } from "../../../../shared/actions.ts";
import { Count, NullableTimestamp } from "../../../../shared/contract.ts";
import { Announcement, AnnouncementCursor, AnnouncementSummary } from "../../../../shared/contracts/announcements.ts";
import type { AuthContext, BackendDatabase } from "./types.ts";
import { validateMarkdownUploadsBeforeCreate } from "./upload-markdown.ts";
import { INPUT_LIMITS, requiredMediaContent, requiredText } from "./validation.ts";

const StoredAnnouncementPage = v.object({
  announcements: v.array(AnnouncementSummary),
  hasMore: v.boolean(),
  cursor: v.nullable(AnnouncementCursor),
  snapshotAt: NullableTimestamp,
  version: Count,
});

export async function listAnnouncements(input: ActionInput<"listAnnouncements">, auth: AuthContext, database: BackendDatabase) {
  return v.parse(StoredAnnouncementPage, await database.call("app_api", "backend_list_announcements_snapshot", {
    actor_uid: auth.uid,
    page_size: input.pageSize,
    cursor_id: input.cursor?.id ?? null,
    cursor_published_at: input.cursor?.publishedAt ?? null,
  }));
}

export async function getAnnouncement(input: ActionInput<"getAnnouncement">, auth: AuthContext, database: BackendDatabase) {
  const announcement = v.parse(Announcement, await database.call("app_api", "backend_get_announcement", {
    announcement_id: input.announcementId,
    actor_uid: auth.uid,
  }));
  return { announcement };
}

export async function getAnnouncementUnreadHint(_input: ActionInput<"getAnnouncementUnreadHint">, auth: AuthContext, database: BackendDatabase) {
  return v.parse(
    v.object({ hasUnread: v.boolean() }),
    await database.call("app_api", "backend_get_announcement_unread_hint", { actor_uid: auth.uid }),
  );
}

export async function markAnnouncementsOpened(input: ActionInput<"markAnnouncementsOpened">, auth: AuthContext, database: BackendDatabase) {
  return v.parse(
    v.object({ success: v.literal(true), openedAt: NullableTimestamp }),
    await database.call("app_api", "backend_mark_announcements_opened", {
      actor_uid: auth.uid,
      opened_through: input.openedThrough,
    }),
  );
}

export async function createAnnouncement(input: ActionInput<"createAnnouncement">, auth: AuthContext, database: BackendDatabase) {
  const content = requiredMediaContent(input.content, "content", INPUT_LIMITS.content, INPUT_LIMITS.contentStorage);
  await validateMarkdownUploadsBeforeCreate(database, auth.uid, content, "announcement");
  const announcement = v.parse(Announcement, await database.call("app_api", "backend_create_announcement", {
    actor_uid: auth.uid,
    announcement_title: requiredText(input.title, "title", INPUT_LIMITS.title),
    announcement_content: content,
  }));
  return { announcement };
}

export async function deleteAnnouncement(input: ActionInput<"deleteAnnouncement">, _auth: AuthContext, database: BackendDatabase) {
  await database.call("app_api", "backend_delete_announcement", { announcement_id: input.announcementId });
  return { success: true as const };
}

export async function setAnnouncementLike(input: ActionInput<"setAnnouncementLike">, auth: AuthContext, database: BackendDatabase) {
  return v.parse(
    v.object({ liked: v.boolean(), likeCount: Count }),
    await database.call("app_api", "backend_set_announcement_like", {
      announcement_id: input.announcementId,
      actor_uid: auth.uid,
      liked: input.liked,
    }),
  );
}
