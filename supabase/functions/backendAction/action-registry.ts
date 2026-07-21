import { getPlatformDashboard } from "./dashboard.ts";
import { handleUserAction } from "./users.ts";
import { handleUploadAction } from "./uploads.ts";
import { handleIssueAction } from "./issues.ts";
import { handleAnnouncementAction } from "./announcements.ts";
import { handleNotificationAction } from "./notifications.ts";
import { handleFacilityAction, listFacilities } from "./facilities.ts";
import { handleCategoryAction } from "./categories.ts";
import type { AuthContext, BackendSupabase, JsonRecord, PermissionCode } from "./types.ts";

export type BackendActionRateLimitGroup =
  | "read"
  | "general-write"
  | "upload-resolve"
  | "upload-write"
  | "admin-write"
  | "sensitive-write";

export type BackendActionDomain =
  | "announcement"
  | "category"
  | "content"
  | "dashboard"
  | "facility"
  | "issue"
  | "notification"
  | "upload"
  | "user";

export interface BackendActionDefinition {
  domain: BackendActionDomain;
  name: string;
  rateLimitGroup: BackendActionRateLimitGroup;
  idempotent?: boolean;
  requiredPermission?: PermissionCode;
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
  options: Pick<BackendActionDefinition, "idempotent" | "requiredPermission" | "requiresRequestId"> = {},
): BackendActionDefinition {
  return {
    domain,
    handler,
    idempotent: options.idempotent === true,
    name,
    rateLimitGroup,
    requiredPermission: options.requiredPermission,
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
  action("getCategoryCatalog", "category", "read", handleCategoryAction),
  action("getCategoryManagement", "category", "read", handleCategoryAction, { requiredPermission: "category.manage" }),
  action("saveIssueCategory", "category", "admin-write", handleCategoryAction, {
    idempotent: true, requiredPermission: "category.manage", requiresRequestId: true,
  }),
  action("saveFacilityCategory", "category", "admin-write", handleCategoryAction, {
    idempotent: true, requiredPermission: "category.manage", requiresRequestId: true,
  }),
  action("savePlatformFeatures", "category", "admin-write", handleCategoryAction, {
    idempotent: true, requiredPermission: "category.manage", requiresRequestId: true,
  }),
  action("deleteCategory", "category", "admin-write", handleCategoryAction, {
    idempotent: true, requiredPermission: "category.manage", requiresRequestId: true,
  }),
  action("completeInitialSetup", "category", "admin-write", handleCategoryAction, {
    idempotent: true, requiresRequestId: true,
  }),

  action("getContentRevisions", "content", "read", async (_action, _payload, _auth, supabase) => {
    const { data, error } = await supabase
      .schema("app_private")
      .from("content_revisions")
      .select("domain,revision");
    if (error) throw error;
    const revisions = { announcements: 0, facilities: 0, issues: 0 };
    for (const row of data ?? []) {
      const domain = String(row.domain);
      if (domain === "announcements" || domain === "facilities" || domain === "issues") {
        revisions[domain] = Number(row.revision);
      }
    }
    if (Object.values(revisions).some((revision) => revision < 1)) {
      throw new Error("upstream-unavailable");
    }
    return { revisions };
  }),

  action("getCurrentUserRole", "user", "read", userHandler),
  action("listRoleAssignments", "user", "read", userHandler, { requiredPermission: "role.manage" }),
  action("setUserRoles", "user", "admin-write", userHandler, {
    idempotent: true, requiredPermission: "role.manage", requiresRequestId: true,
  }),
  action("recordPlatformVisit", "user", "general-write", userHandler),
  action("cacheUserAvatar", "user", "sensitive-write", userHandler),
  action("getUserAvatarUrls", "user", "read", userHandler),

  idempotentWrite("createImageUploadSessions", "upload", "upload-write", uploadHandler),
  idempotentWrite("finalizeImageUploads", "upload", "upload-write", uploadHandler),
  idempotentWrite("deleteUploadedImages", "upload", "upload-write", uploadHandler),
  action("resolveUploadImageUrls", "upload", "upload-resolve", uploadHandler),

  action("getIssue", "issue", "read", issueHandler),
  action("listIssues", "issue", "read", issueHandler),
  action("searchIssues", "issue", "read", issueHandler),
  action("listUserIssues", "issue", "read", issueHandler),
  idempotentWrite("createIssue", "issue", "sensitive-write", issueHandler),
  action("moderateIssueStatus", "issue", "admin-write", issueHandler, {
    idempotent: true, requiredPermission: "proposal.manage", requiresRequestId: true,
  }),
  action("setIssueCommentsEnabled", "issue", "admin-write", issueHandler, {
    idempotent: true, requiredPermission: "proposal.manage", requiresRequestId: true,
  }),
  action("updateIssueResult", "issue", "admin-write", issueHandler, {
    idempotent: true, requiredPermission: "proposal.manage", requiresRequestId: true,
  }),
  idempotentWrite("toggleSupport", "issue", "sensitive-write", issueHandler),
  idempotentWrite("removeSupport", "issue", "sensitive-write", issueHandler),
  idempotentWrite("deleteIssue", "issue", "admin-write", issueHandler),
  action("listComments", "issue", "read", issueHandler),
  idempotentWrite("createComment", "issue", "sensitive-write", issueHandler),
  idempotentWrite("deleteComment", "issue", "sensitive-write", issueHandler),

  action("listFacilities", "facility", "read", async (_action, payload, auth, supabase) => await listFacilities(payload, auth, supabase)),
  action("getFacility", "facility", "read", handleFacilityAction),
  idempotentWrite("createFacility", "facility", "sensitive-write", handleFacilityAction),
  idempotentWrite("toggleFacilityAffected", "facility", "sensitive-write", handleFacilityAction),
  action("updateFacilityStatus", "facility", "admin-write", handleFacilityAction, {
    idempotent: true, requiresRequestId: true,
  }),
  idempotentWrite("deleteFacility", "facility", "admin-write", handleFacilityAction),

  action("listAnnouncements", "announcement", "read", announcementHandler),
  action("getAnnouncement", "announcement", "read", announcementHandler),
  action("createAnnouncement", "announcement", "admin-write", announcementHandler, {
    idempotent: true, requiredPermission: "announcement.manage", requiresRequestId: true,
  }),
  action("deleteAnnouncement", "announcement", "admin-write", announcementHandler, {
    idempotent: true, requiredPermission: "announcement.manage", requiresRequestId: true,
  }),
  idempotentWrite("setAnnouncementLike", "announcement", "sensitive-write", announcementHandler),
  action("listAnnouncementComments", "announcement", "read", announcementHandler),
  idempotentWrite("createAnnouncementComment", "announcement", "sensitive-write", announcementHandler),
  idempotentWrite("deleteAnnouncementComment", "announcement", "sensitive-write", announcementHandler),

  action("listNotificationPages", "notification", "read", notificationHandler),
  action("getNotificationSnapshot", "notification", "read", notificationHandler),
  action("getNotificationReadState", "notification", "read", notificationHandler),
  action("getNotificationUnreadHint", "notification", "read", notificationHandler),
  action("markNotificationsOpened", "notification", "general-write", notificationHandler),
  action("getPushNotificationPreference", "notification", "read", notificationHandler),
  action("registerPushToken", "notification", "sensitive-write", notificationHandler),
  action("unregisterPushToken", "notification", "sensitive-write", notificationHandler),
  action("updatePushNotificationPreferences", "notification", "general-write", notificationHandler),

  action("getPlatformDashboard", "dashboard", "read", async (_action, _payload, _auth, supabase) => {
    return await getPlatformDashboard(supabase);
  }, { requiredPermission: "dashboard.view" }),
] as const satisfies readonly BackendActionDefinition[];

const backendActionDefinitionMap = new Map(
  backendActionDefinitions.map((definition) => [definition.name, definition]),
);

export function getBackendActionDefinition(actionName: string) {
  return backendActionDefinitionMap.get(actionName);
}
