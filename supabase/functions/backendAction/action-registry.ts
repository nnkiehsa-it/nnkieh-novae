import { getPlatformDashboard } from "./dashboard.ts";
import { handleUserAction } from "./users.ts";
import { handleUploadAction } from "./uploads.ts";
import { handleIssueAction } from "./issues.ts";
import { handleAnnouncementAction } from "./announcements.ts";
import { handleNotificationAction } from "./notifications.ts";
import type { AuthContext, BackendSupabase, JsonRecord } from "./types.ts";

export type BackendActionRateLimitGroup =
  | "read"
  | "general-write"
  | "upload-resolve"
  | "admin-write"
  | "sensitive-write";

export type BackendActionDomain =
  | "announcement"
  | "dashboard"
  | "issue"
  | "notification"
  | "upload"
  | "user";

export interface BackendActionDefinition {
  domain: BackendActionDomain;
  name: string;
  rateLimitGroup: BackendActionRateLimitGroup;
  idempotent?: boolean;
  requiresAdmin?: boolean;
  requiresRequestId?: boolean;
  handler: (
    action: string,
    payload: JsonRecord,
    auth: AuthContext,
    supabase: BackendSupabase,
  ) => Promise<JsonRecord>;
}

const issueHandler = handleIssueAction;
const announcementHandler = handleAnnouncementAction;
const notificationHandler = handleNotificationAction;
const uploadHandler = handleUploadAction;
const userHandler = handleUserAction;

function action(
  name: string,
  domain: BackendActionDomain,
  rateLimitGroup: BackendActionRateLimitGroup,
  handler: BackendActionDefinition["handler"],
  options: Pick<BackendActionDefinition, "idempotent" | "requiresAdmin" | "requiresRequestId"> = {},
): BackendActionDefinition {
  return {
    domain,
    handler,
    idempotent: options.idempotent === true,
    name,
    rateLimitGroup,
    requiresAdmin: options.requiresAdmin === true,
    requiresRequestId: options.requiresRequestId === true,
  };
}

function idempotentWrite(
  name: string,
  domain: BackendActionDomain,
  rateLimitGroup: BackendActionRateLimitGroup,
  handler: BackendActionDefinition["handler"],
) {
  return action(name, domain, rateLimitGroup, handler, {
    idempotent: true,
    requiresRequestId: true,
  });
}

export const backendActionDefinitions = [
  action("getCurrentUserRole", "user", "read", userHandler),
  action("recordPlatformVisit", "user", "general-write", userHandler),
  action("cacheUserAvatar", "user", "sensitive-write", userHandler),
  action("getUserAvatarUrls", "user", "read", userHandler),

  idempotentWrite("createImageUploadSession", "upload", "sensitive-write", uploadHandler),
  idempotentWrite("finalizeImageUpload", "upload", "sensitive-write", uploadHandler),
  idempotentWrite("deleteUploadedImage", "upload", "sensitive-write", uploadHandler),
  action("resolveUploadImageUrls", "upload", "upload-resolve", uploadHandler),

  action("getIssue", "issue", "read", issueHandler),
  action("listIssues", "issue", "read", issueHandler),
  action("searchIssues", "issue", "read", issueHandler),
  action("listUserIssues", "issue", "read", issueHandler),
  idempotentWrite("createIssue", "issue", "sensitive-write", issueHandler),
  idempotentWrite("moderateIssueStatus", "issue", "admin-write", issueHandler),
  idempotentWrite("updateIssueResult", "issue", "admin-write", issueHandler),
  idempotentWrite("toggleSupport", "issue", "sensitive-write", issueHandler),
  idempotentWrite("removeSupport", "issue", "sensitive-write", issueHandler),
  idempotentWrite("deleteIssue", "issue", "admin-write", issueHandler),
  action("listComments", "issue", "read", issueHandler),
  idempotentWrite("createComment", "issue", "sensitive-write", issueHandler),
  idempotentWrite("deleteComment", "issue", "sensitive-write", issueHandler),

  action("listAnnouncements", "announcement", "read", announcementHandler),
  action("getAnnouncement", "announcement", "read", announcementHandler),
  idempotentWrite("createAnnouncement", "announcement", "admin-write", announcementHandler),
  idempotentWrite("updateAnnouncement", "announcement", "admin-write", announcementHandler),
  idempotentWrite("deleteAnnouncement", "announcement", "admin-write", announcementHandler),
  idempotentWrite("setAnnouncementLike", "announcement", "sensitive-write", announcementHandler),
  action("listAnnouncementComments", "announcement", "read", announcementHandler),
  idempotentWrite("createAnnouncementComment", "announcement", "sensitive-write", announcementHandler),
  idempotentWrite("deleteAnnouncementComment", "announcement", "sensitive-write", announcementHandler),

  action("listNotifications", "notification", "read", notificationHandler),
  action("getNotificationSnapshot", "notification", "read", notificationHandler),
  action("getNotificationReadState", "notification", "read", notificationHandler),
  action("markNotificationsOpened", "notification", "general-write", notificationHandler),
  action("getPushNotificationPreference", "notification", "read", notificationHandler),
  action("registerPushToken", "notification", "sensitive-write", notificationHandler),
  action("unregisterPushToken", "notification", "sensitive-write", notificationHandler),
  action("updatePushNotificationPreferences", "notification", "general-write", notificationHandler),

  action("getPlatformDashboard", "dashboard", "read", async (_action, _payload, _auth, supabase) => {
    return await getPlatformDashboard(supabase);
  }, { requiresAdmin: true }),
] as const satisfies readonly BackendActionDefinition[];

const backendActionDefinitionMap = new Map(
  backendActionDefinitions.map((definition) => [definition.name, definition]),
);

export function getBackendActionDefinition(actionName: string) {
  return backendActionDefinitionMap.get(actionName);
}
