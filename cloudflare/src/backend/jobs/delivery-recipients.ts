import { asString } from "../shared/http.ts";
import type { AppDatabaseClient } from "../database/client.ts";
import { checked, type EventDeliveryItem } from "./delivery-attempt.ts";

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
    const table = isFacility
      ? "user_facility_category_assignments"
      : "user_issue_category_assignments";
    let query = database.table("app_private", table).select("uid").eq("category_id", categoryId);
    if (isFacility) query = query.eq("notify_on_created", true);
    const { data } = await checked(query);
    const uids: string[] = (data ?? []).map((row: any) => asString(row.uid)).filter((uid: string) => Boolean(uid && uid !== actor_uid));
    return [...new Set(uids)];
  }

  if (event_type === "facility.status_changed") {
    const authorUid = asString(payload.author_uid);
    const { data } = await checked(database
      .table("app_private", "facility_report_affected_users")
      .select("uid")
      .eq("facility_id", aggregate_id));
    const affectedUids: string[] = [authorUid, ...(data ?? []).map((row: any) => asString(row.uid))].filter(Boolean);
    return [...new Set(affectedUids)];
  }

  if (event_type === "issue.status_changed" || event_type === "support.goal_met" || event_type === "issue.deleted") {
    let authorUid = asString(payload.author_uid);
    if (!authorUid) {
      const { data } = await checked(database.table("app_private", "issues").select("author_uid").eq("id", aggregate_id).maybeSingle());
      authorUid = asString(data?.author_uid);
    }
    let supporterUids: string[] = [];
    if (event_type !== "issue.deleted") {
      const { data } = await checked(database.table("app_private", "supports").select("uid").eq("issue_id", aggregate_id));
      supporterUids = (data ?? []).map((row: any) => asString(row.uid)).filter(Boolean);
    }
    return [...new Set([authorUid, ...supporterUids].filter(Boolean))].filter(
      (uid) => event_type === "support.goal_met" || uid !== actor_uid,
    );
  }

  if (event_type === "issue.comment_created") {
    const parentCommentId = asString(payload.parent_comment_id);
    let parentAuthorUid = asString(payload.parent_author_uid);
    if (!parentAuthorUid && parentCommentId) {
      const { data } = await checked(database.table("app_private", "comments").select("author_uid").eq("id", parentCommentId).maybeSingle());
      parentAuthorUid = asString(data?.author_uid);
    }
    if (parentAuthorUid && parentAuthorUid !== actor_uid) return [parentAuthorUid];
    const { data } = await checked(database.table("app_private", "issues").select("author_uid").eq("id", aggregate_id).maybeSingle());
    const issueAuthorUid = asString(data?.author_uid);
    return issueAuthorUid && issueAuthorUid !== actor_uid ? [issueAuthorUid] : [];
  }

  if (event_type === "announcement.comment_created") {
    const parentCommentId = asString(payload.parent_comment_id);
    let parentAuthorUid = asString(payload.parent_author_uid);
    if (!parentAuthorUid && parentCommentId) {
      const { data } = await checked(database.table("app_private", "announcement_comments").select("author_uid").eq("id", parentCommentId).maybeSingle());
      parentAuthorUid = asString(data?.author_uid);
    }
    if (parentAuthorUid && parentAuthorUid !== actor_uid) return [parentAuthorUid];
    const { data } = await checked(database.table("app_private", "announcements").select("author_uid").eq("id", aggregate_id).maybeSingle());
    const annAuthorUid = asString(data?.author_uid);
    return annAuthorUid && annAuthorUid !== actor_uid ? [annAuthorUid] : [];
  }

  return [];
}
