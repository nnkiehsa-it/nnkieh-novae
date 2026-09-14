import { asString } from "../shared/http.ts";
import type { AppDatabaseClient } from "../database/client.ts";
import type { EventDeliveryItem } from "./delivery-attempt.ts";
import type { Selected } from "../database/schema.ts";

/**
 * Who hears about an event.
 *
 * Each kind of event has its own audience — the managers of a category, the
 * author and the supporters of a proposal, the person a comment replies to —
 * and none of them include whoever caused it, except where being told is the
 * point, as with a proposal reaching its threshold.
 */
export async function resolveRecipients(
  database: AppDatabaseClient,
  item: EventDeliveryItem,
): Promise<string[]> {
  const { event_type, aggregate_id, actor_uid, payload } = item;

  if (event_type === "issue.created" || event_type === "facility.created") {
    const isFacility = event_type === "facility.created";
    const categoryId = asString(payload[isFacility ? "category_id" : "category"]);
    const { rows } = isFacility
      ? await database.sql<Selected<"user_facility_category_assignments", "uid">>`
        select uid from app_private.user_facility_category_assignments
        where category_id = ${categoryId} and notify_on_created = true`
      : await database.sql<Selected<"user_issue_category_assignments", "uid">>`
        select uid from app_private.user_issue_category_assignments where category_id = ${categoryId}`;
    return [...new Set(rows.map((row) => row.uid).filter((uid) => Boolean(uid) && uid !== actor_uid))];
  }

  if (event_type === "facility.status_changed") {
    const authorUid = asString(payload.author_uid);
    const { rows } = await database.sql<Selected<"facility_report_affected_users", "uid">>`
      select uid from app_private.facility_report_affected_users where facility_id = ${aggregate_id}`;
    return [...new Set([authorUid, ...rows.map((row) => row.uid)].filter(Boolean))];
  }

  if (event_type === "issue.status_changed" || event_type === "support.goal_met" || event_type === "issue.deleted") {
    let authorUid = asString(payload.author_uid);
    if (!authorUid) {
      const issue = await database.sqlMaybe<Selected<"issues", "author_uid">>`
        select author_uid from app_private.issues where id = ${aggregate_id}`;
      authorUid = asString(issue?.author_uid);
    }
    let supporterUids: string[] = [];
    if (event_type !== "issue.deleted") {
      const { rows } = await database.sql<Selected<"supports", "uid">>`
        select uid from app_private.supports where issue_id = ${aggregate_id}`;
      supporterUids = rows.map((row) => row.uid).filter(Boolean);
    }
    return [...new Set([authorUid, ...supporterUids].filter(Boolean))].filter(
      (uid) => event_type === "support.goal_met" || uid !== actor_uid,
    );
  }

  if (event_type === "issue.comment_created") {
    const parentCommentId = asString(payload.parent_comment_id);
    let parentAuthorUid = asString(payload.parent_author_uid);
    if (!parentAuthorUid && parentCommentId) {
      const comment = await database.sqlMaybe<Selected<"comments", "author_uid">>`
        select author_uid from app_private.comments where id = ${parentCommentId}`;
      parentAuthorUid = asString(comment?.author_uid);
    }
    if (parentAuthorUid && parentAuthorUid !== actor_uid) return [parentAuthorUid];
    const issue = await database.sqlMaybe<Selected<"issues", "author_uid">>`
      select author_uid from app_private.issues where id = ${aggregate_id}`;
    const issueAuthorUid = asString(issue?.author_uid);
    return issueAuthorUid && issueAuthorUid !== actor_uid ? [issueAuthorUid] : [];
  }

  if (event_type === "announcement.comment_created") {
    const parentCommentId = asString(payload.parent_comment_id);
    let parentAuthorUid = asString(payload.parent_author_uid);
    if (!parentAuthorUid && parentCommentId) {
      const comment = await database.sqlMaybe<Selected<"announcement_comments", "author_uid">>`
        select author_uid from app_private.announcement_comments where id = ${parentCommentId}`;
      parentAuthorUid = asString(comment?.author_uid);
    }
    if (parentAuthorUid && parentAuthorUid !== actor_uid) return [parentAuthorUid];
    const announcement = await database.sqlMaybe<Selected<"announcements", "author_uid">>`
      select author_uid from app_private.announcements where id = ${aggregate_id}`;
    const annAuthorUid = asString(announcement?.author_uid);
    return annAuthorUid && annAuthorUid !== actor_uid ? [annAuthorUid] : [];
  }

  return [];
}
