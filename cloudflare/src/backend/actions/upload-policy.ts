import type { UploadTargetType } from "../shared/platform-settings.ts";
import type { BackendDatabase } from "./types.ts";
import type { Selected } from "../database/schema.ts";
import { asUuid } from "./utils.ts";

/** Resolve from the actual parent for comments, never from a caller-supplied category. */
export async function loadImageLimit(database: BackendDatabase, targetType: UploadTargetType, scopeId: string) {
  const setup = await database.sqlOne<Selected<"system_setup", "issues_enabled" | "facilities_enabled" | "announcement_comments_enabled" | "announcement_max_images" | "announcement_comment_max_images">>`
    select issues_enabled, facilities_enabled, announcement_comments_enabled,
      announcement_max_images, announcement_comment_max_images
    from app_private.system_setup where singleton`;
  if (targetType === "announcement") return setup.announcement_max_images;
  if (targetType === "announcement_comment") {
    const id = asUuid(scopeId);
    if (!id) throw new Error("not-found");
    const parent = await database.sqlMaybe<Selected<"announcements", "comments_enabled">>`
      select comments_enabled from app_private.announcements where id=${id}`;
    if (!parent) throw new Error("not-found");
    if (!setup.announcement_comments_enabled || !parent.comments_enabled) throw new Error("comments-disabled");
    return setup.announcement_comment_max_images;
  }
  if (targetType === "facility") {
    if (!setup.facilities_enabled) throw new Error("permission-denied");
    const category = await database.sqlMaybe<Selected<"facility_categories", "max_images">>`
      select max_images from app_private.facility_categories where id=${scopeId} and is_active`;
    if (!category) throw new Error("invalid-facility-category");
    return category.max_images;
  }
  if (!setup.issues_enabled) throw new Error("permission-denied");
  if (targetType === "comment") {
    const id = asUuid(scopeId);
    if (!id) throw new Error("not-found");
    const parent = await database.sqlMaybe<{ comment_max_images: number; comments_enabled: boolean; status: string; category_comments_enabled: boolean }>`
      select category.comment_max_images, issue.comments_enabled, issue.status,
        category.comments_enabled as category_comments_enabled
      from app_private.issues issue join app_private.issue_categories category on category.id=issue.category
      where issue.id=${id}`;
    if (!parent) throw new Error("not-found");
    if (!parent.comments_enabled || !parent.category_comments_enabled
      || ["completed", "infeasible", "review-rejected", "auto-rejected"].includes(parent.status)) throw new Error("comments-disabled");
    return parent.comment_max_images;
  }
  const category = await database.sqlMaybe<Selected<"issue_categories", "max_images">>`
    select max_images from app_private.issue_categories where id=${scopeId} and is_active`;
  if (!category) throw new Error("invalid-issue-category");
  return category.max_images;
}
