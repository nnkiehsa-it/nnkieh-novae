import * as v from "valibot";
import { Count } from "../contract.ts";
import { Notification, NotificationReadState } from "./notifications.ts";

export const ContentChangeType = v.picklist([
  "issue_changed",
  "issue_support_changed",
  "issue_comment_changed",
  "announcement_changed",
  "announcement_metrics_changed",
  "announcement_comment_changed",
  "facility_changed",
]);
export type ContentChangeType = v.InferOutput<typeof ContentChangeType>;

/** Something a reader may be looking at changed; for a comment, `parentId` is what it was left on. */
export const ContentChange = v.object({
  eventType: ContentChangeType,
  op: v.picklist(["insert", "update", "delete"]),
  targetId: v.string(),
  parentId: v.nullable(v.string()),
  aggregateRevision: Count,
  domainRevision: Count,
  supportCount: v.nullable(Count),
  likeCount: v.nullable(Count),
  commentCount: v.nullable(Count),
});
export type ContentChange = v.InferOutput<typeof ContentChange>;

/** Every event an open socket can receive, and what it carries. */
export const REALTIME_EVENTS = {
  content_changed: ContentChange,
  notification_insert: v.object({ ...Notification.entries, recipientUid: v.nullable(v.string()) }),
  notification_state_changed: NotificationReadState,
};

export type RealtimeEventName = keyof typeof REALTIME_EVENTS;
export type RealtimePayload<E extends RealtimeEventName> = v.InferOutput<(typeof REALTIME_EVENTS)[E]>;
