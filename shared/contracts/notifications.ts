import * as v from "valibot";
import { action, Count, NoInput, NullableTimestamp, OptionalText, pageSize, RequiredText, Success, Timestamp, Uuid } from "../contract.ts";
import { FACILITY_STATUSES, ISSUE_STATUSES } from "./statuses.ts";

export const NotificationSource = v.picklist(["broadcast", "admin", "user"]);
export type NotificationSource = v.InferOutput<typeof NotificationSource>;

export const NotificationType = v.picklist([
  "announcement_created",
  "announcement_comment_created",
  "facility_status_changed",
  "facility_report_created",
  "issue_created",
  "issue_comment_created",
  "issue_status_changed",
  "support_goal_met",
  "issue_deleted",
]);
export type NotificationType = v.InferOutput<typeof NotificationType>;

export const NotificationTargetType = v.picklist(["announcement", "facility", "issue"]);
export type NotificationTargetType = v.InferOutput<typeof NotificationTargetType>;

const ContentStatus = v.picklist([...new Set([...ISSUE_STATUSES, ...FACILITY_STATUSES])]);

export const Notification = v.object({
  id: Uuid,
  source: NotificationSource,
  type: NotificationType,
  targetType: NotificationTargetType,
  targetId: v.string(),
  commentId: v.nullable(v.string()),
  title: v.string(),
  actorUid: v.nullable(v.string()),
  bodyPreview: v.nullable(v.string()),
  issueCategory: v.nullable(v.string()),
  oldStatus: v.nullable(ContentStatus),
  newStatus: v.nullable(ContentStatus),
  isRead: v.boolean(),
  createdAt: Timestamp,
});
export type Notification = v.InferOutput<typeof Notification>;

export const NotificationCursor = v.object({ id: Uuid, createdAt: Timestamp });
export type NotificationCursor = v.InferOutput<typeof NotificationCursor>;

export const NotificationPage = v.object({
  notifications: v.array(Notification),
  hasMore: v.boolean(),
  cursor: v.nullable(NotificationCursor),
});
export type NotificationPage = v.InferOutput<typeof NotificationPage>;

/** One page per source asked for; a source the account may not read is left out. */
const NotificationPages = v.object({
  broadcast: v.optional(NotificationPage),
  admin: v.optional(NotificationPage),
  user: v.optional(NotificationPage),
});

/** When the account last opened each inbox; anything newer is unread. */
export const NotificationReadState = v.object({
  announcementOpenedAt: NullableTimestamp,
  broadcastOpenedAt: NullableTimestamp,
  adminOpenedAt: NullableTimestamp,
  userOpenedAt: NullableTimestamp,
});
export type NotificationReadState = v.InferOutput<typeof NotificationReadState>;

export const BrowserPermission = v.picklist(["default", "denied", "granted"]);
export type BrowserPermission = v.InferOutput<typeof BrowserPermission>;

export const PushPreference = v.object({
  deviceEnabled: v.boolean(),
  enabled: v.boolean(),
  permission: BrowserPermission,
  tokenCount: Count,
});
export type PushPreference = v.InferOutput<typeof PushPreference>;

/** A device this account receives push notifications on, as the account's device list shows it. */
export const PushDevice = v.object({
  deviceId: RequiredText,
  lastConfirmedAt: Timestamp,
  platform: v.string(),
  userAgent: v.string(),
});
export type PushDevice = v.InferOutput<typeof PushDevice>;

export const AdminNotificationPreferences = v.object({
  issueNotifications: v.boolean(),
  facilityNotifications: v.boolean(),
  commentNotifications: v.boolean(),
});
export type AdminNotificationPreferences = v.InferOutput<typeof AdminNotificationPreferences>;

export const NOTIFICATION_ACTIONS = {
  listNotificationPages: action({
    group: "read",
    input: v.object({
      requests: v.pipe(v.array(v.object({
        source: NotificationSource,
        pageSize: pageSize(30, 10),
        cursor: v.optional(v.nullable(NotificationCursor), null),
      })), v.minLength(1), v.maxLength(3)),
    }),
    output: v.object({ pages: NotificationPages }),
  }),
  getNotificationSnapshot: action({
    group: "read",
    input: v.object({ sources: v.optional(v.array(NotificationSource), ["broadcast", "user"]) }),
    output: v.object({ openedAt: Timestamp, pages: NotificationPages, state: NotificationReadState }),
  }),
  getNotificationReadState: action({
    group: "read",
    input: NoInput,
    output: v.object({ state: NotificationReadState }),
  }),
  getNotificationUnreadHint: action({
    group: "read",
    input: NoInput,
    output: v.object({ hasUnread: v.boolean() }),
  }),
  markNotificationsOpened: action({
    group: "general-write",
    extraLimit: "preferenceWriteHourly",
    input: NoInput,
    output: v.object({ success: v.literal(true), openedAt: Timestamp }),
  }),
  getPushNotificationPreference: action({
    group: "read",
    input: v.object({ deviceId: OptionalText, permission: v.optional(BrowserPermission, "default") }),
    output: PushPreference,
  }),
  registerPushToken: action({
    group: "sensitive-write",
    extraLimit: "pushTokenWriteHourly",
    input: v.object({
      token: RequiredText,
      deviceId: RequiredText,
      permission: BrowserPermission,
      platform: OptionalText,
      userAgent: OptionalText,
      /**
       * Only keep an existing registration current (its token, its last
       * confirmation); a device that was removed stays removed until the
       * reader turns push on again.
       */
      refresh: v.optional(v.boolean(), false),
    }),
    output: PushPreference,
  }),
  listPushDevices: action({
    group: "read",
    input: NoInput,
    output: v.object({ devices: v.array(PushDevice), limit: Count }),
  }),
  unregisterPushToken: action({
    group: "sensitive-write",
    input: v.object({ deviceId: RequiredText }),
    output: Success,
  }),
  getPlatformAdminNotificationPreferences: action({
    group: "read",
    input: NoInput,
    output: AdminNotificationPreferences,
  }),
  updatePlatformAdminNotificationPreferences: action({
    group: "general-write",
    extraLimit: "preferenceWriteHourly",
    input: v.object({ preferences: AdminNotificationPreferences }),
    output: AdminNotificationPreferences,
  }),
};
