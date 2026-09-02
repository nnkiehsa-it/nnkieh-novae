import { handleDashboardAction } from "./dashboard.ts";
import { handleUserAction } from "./users.ts";
import { handleUploadAction } from "./uploads.ts";
import { handleIssueAction } from "./issues.ts";
import { handleAnnouncementAction } from "./announcements.ts";
import { handleNotificationAction } from "./notifications.ts";
import { handleFacilityAction, listFacilities } from "./facilities.ts";
import { handleCategoryAction } from "./categories.ts";
import { getSessionBootstrap } from "./session-bootstrap.ts";
import { loadContentVersions } from "./content-versions.ts";
import type { AuthContext, BackendDatabase, JsonRecord, PermissionCode } from "./types.ts";

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
  requiredPermission?: PermissionCode;
  handler: (
    action: string,
    payload: JsonRecord,
    auth: AuthContext,
    database: BackendDatabase,
  ) => Promise<unknown>;
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
  options: Pick<BackendActionDefinition, "requiredPermission"> = {},
): BackendActionDefinition {
  return {
    domain,
    handler,
    name,
    rateLimitGroup,
    requiredPermission: options.requiredPermission,
  };
}

export const backendActionDefinitions = [
  action("getCategoryCatalog", "category", "read", handleCategoryAction),
  action("getCategoryManagement", "category", "read", handleCategoryAction, { requiredPermission: "category.manage" }),
  action("estimateCategoryPolicyChanges", "category", "read", handleCategoryAction, { requiredPermission: "category.manage" }),
  action("estimateRetentionCleanup", "category", "read", handleCategoryAction, { requiredPermission: "category.manage" }),
  action("listPlatformJobs", "category", "read", handleCategoryAction, { requiredPermission: "category.manage" }),
  action("savePlatformSettings", "category", "admin-write", handleCategoryAction, { requiredPermission: "category.manage" }),
  action("saveCategoryManagement", "category", "admin-write", handleCategoryAction, { requiredPermission: "category.manage" }),
  action("savePlatformFeatures", "category", "admin-write", handleCategoryAction, { requiredPermission: "category.manage" }),
  action("completeInitialSetup", "category", "admin-write", handleCategoryAction),

  action("getContentVersions", "content", "read", async (_action, _payload, _auth, database) => ({
    versions: await loadContentVersions(database),
  })),

  action("getSessionBootstrap", "user", "read", async (_action, payload, auth, database) => {
    return await getSessionBootstrap(payload, auth, database);
  }),
  action("getCurrentUserRole", "user", "read", userHandler),
  action("listRoleAssignments", "user", "read", userHandler, { requiredPermission: "role.manage" }),
  action("listAdminUsers", "user", "read", userHandler, { requiredPermission: "role.manage" }),
  action("listAdminAudit", "user", "read", userHandler, { requiredPermission: "role.manage" }),
  action("listAdminActivity", "user", "read", userHandler, { requiredPermission: "dashboard.view" }),
  action("getAdminOverview", "user", "read", userHandler, { requiredPermission: "dashboard.view" }),
  action("setUserRestriction", "user", "admin-write", userHandler, { requiredPermission: "role.manage" }),
  action("setUserAccessScope", "user", "admin-write", userHandler, { requiredPermission: "role.manage" }),
  action("cacheUserAvatar", "user", "sensitive-write", userHandler),
  action("getUserPublicProfiles", "user", "read", userHandler),

  action("createImageUploadSessions", "upload", "upload-write", uploadHandler),
  action("finalizeImageUploads", "upload", "upload-write", uploadHandler),
  action("deleteUploadedImages", "upload", "upload-write", uploadHandler),
  action("resolveUploadImageUrls", "upload", "upload-resolve", uploadHandler),

  action("getIssue", "issue", "read", issueHandler),
  action("listIssues", "issue", "read", issueHandler),
  action("searchIssues", "issue", "read", issueHandler),
  action("listUserIssues", "issue", "read", issueHandler),
  action("createIssue", "issue", "sensitive-write", issueHandler),
  action("moderateIssueStatus", "issue", "admin-write", issueHandler, { requiredPermission: "proposal.manage" }),
  action("updateIssueResult", "issue", "admin-write", issueHandler, { requiredPermission: "proposal.manage" }),
  action("toggleSupport", "issue", "sensitive-write", issueHandler),
  action("removeSupport", "issue", "sensitive-write", issueHandler),
  action("deleteIssue", "issue", "admin-write", issueHandler),
  action("listComments", "issue", "read", issueHandler),
  action("createComment", "issue", "sensitive-write", issueHandler),
  action("deleteComment", "issue", "sensitive-write", issueHandler),

  action("listFacilities", "facility", "read", async (_action, payload, auth, database) => await listFacilities(payload, auth, database)),
  action("getFacility", "facility", "read", handleFacilityAction),
  action("createFacility", "facility", "sensitive-write", handleFacilityAction),
  action("toggleFacilityAffected", "facility", "sensitive-write", handleFacilityAction),
  action("updateFacilityStatus", "facility", "admin-write", handleFacilityAction),
  action("deleteFacility", "facility", "admin-write", handleFacilityAction),

  action("listAnnouncements", "announcement", "read", announcementHandler),
  action("getAnnouncement", "announcement", "read", announcementHandler),
  action("createAnnouncement", "announcement", "admin-write", announcementHandler, { requiredPermission: "announcement.manage" }),
  action("deleteAnnouncement", "announcement", "admin-write", announcementHandler, { requiredPermission: "announcement.manage" }),
  action("setAnnouncementLike", "announcement", "sensitive-write", announcementHandler),
  action("listAnnouncementComments", "announcement", "read", announcementHandler),
  action("createAnnouncementComment", "announcement", "sensitive-write", announcementHandler),
  action("deleteAnnouncementComment", "announcement", "sensitive-write", announcementHandler),

  action("listNotificationPages", "notification", "read", notificationHandler),
  action("getNotificationSnapshot", "notification", "read", notificationHandler),
  action("getNotificationReadState", "notification", "read", notificationHandler),
  action("getNotificationUnreadHint", "notification", "read", notificationHandler),
  action("markNotificationsOpened", "notification", "general-write", notificationHandler),
  action("getPushNotificationPreference", "notification", "read", notificationHandler),
  action("registerPushToken", "notification", "sensitive-write", notificationHandler),
  action("unregisterPushToken", "notification", "sensitive-write", notificationHandler),
  action("updatePushNotificationPreferences", "notification", "general-write", notificationHandler),

  action("getPlatformDashboard", "dashboard", "read", handleDashboardAction, {
    requiredPermission: "dashboard.view",
  }),
  action("listDeletionJobs", "dashboard", "read", handleDashboardAction, {
    requiredPermission: "dashboard.view",
  }),
  action("retryDeletionJob", "dashboard", "admin-write", handleDashboardAction, {
    requiredPermission: "role.manage",
  }),
] as const satisfies readonly BackendActionDefinition[];

const backendActionDefinitionMap = new Map(
  backendActionDefinitions.map((definition) => [definition.name, definition]),
);

export function getBackendActionDefinition(actionName: string) {
  return backendActionDefinitionMap.get(actionName);
}
