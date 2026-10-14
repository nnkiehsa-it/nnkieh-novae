import type { ActionInput, ActionName } from "../../../../shared/actions.ts";
import type { ActionSegment, AuthContext, BackendDatabase, PermissionCode } from "./types.ts";
import * as operations from "./operations.ts";
import * as categories from "./categories.ts";
import * as contentVersions from "./content-versions.ts";
import { getSessionBootstrap } from "./session-bootstrap.ts";
import * as users from "./users.ts";
import * as userAccess from "./user-access.ts";
import * as userAdmin from "./user-admin.ts";
import * as accessRules from "./account-access-rules.ts";
import { handleUploadAction } from "./uploads.ts";
import { handleIssueAction } from "./issues.ts";
import * as facilities from "./facilities.ts";
import { handleAnnouncementAction } from "./announcements.ts";
import * as notifications from "./notifications.ts";
import * as dashboard from "./dashboard.ts";

export type ActionDomain =
  | "announcement"
  | "category"
  | "content"
  | "dashboard"
  | "facility"
  | "issue"
  | "notification"
  | "upload"
  | "user";

/**
 * What an action asks of the account's access rules. A read-only account may
 * read and change its own settings; a reaction-only one may also react.
 */
export type AccountAccessClass = "read" | "personal" | "reaction" | "participation" | "admin";

export interface ActionHandler<N extends ActionName> {
  domain: ActionDomain;
  access: AccountAccessClass;
  /** The permission the action requires before anything else runs. */
  permission?: PermissionCode;
  /** Holders of this permission use a participation action as moderators, which account restrictions do not stop. */
  moderatedBy?: PermissionCode;
  run: (input: ActionInput<N>, auth: AuthContext, database: BackendDatabase) => Promise<unknown> | AsyncIterable<ActionSegment>;
}

type ActionHandlers = { [N in ActionName]: ActionHandler<N> };

/** How the Worker carries out each action in the shared contract. */
export const ACTION_HANDLERS: ActionHandlers = {
  getRuntimePolicies: { domain: "category", access: "read", run: operations.getRuntimePolicies },
  getProviderDiagnostics: { domain: "dashboard", access: "read", permission: "dashboard.view", run: operations.getProviderDiagnostics },
  rebuildNotionArchive: { domain: "dashboard", access: "admin", permission: "role.manage", run: operations.rebuildNotionArchive },
  clearOperationalErrors: { domain: "dashboard", access: "admin", permission: "role.manage", run: operations.clearOperationalErrors },
  clearScheduledWork: { domain: "dashboard", access: "admin", permission: "role.manage", run: operations.clearScheduledWork },
  retryOperationalWork: { domain: "dashboard", access: "admin", permission: "role.manage", run: operations.retryOperationalWork },
  getOperationsConsole: { domain: "dashboard", access: "read", permission: "dashboard.view", run: operations.getOperationsConsole },
  getOperationsQueue: { domain: "dashboard", access: "read", permission: "dashboard.view", run: operations.getOperationsQueue },
  getOperationPolicies: { domain: "dashboard", access: "read", permission: "dashboard.view", run: operations.getOperationPolicies },
  saveOperationPolicies: { domain: "category", access: "admin", permission: "category.manage", run: operations.saveOperationPolicies },
  getCategoryCatalog: { domain: "category", access: "read", run: categories.getCategoryCatalog },
  getCategoryManagement: { domain: "category", access: "read", permission: "category.manage", run: categories.getCategoryManagement },
  estimateCategoryPolicyChanges: { domain: "category", access: "read", permission: "category.manage", run: categories.estimateCategoryPolicyChanges },
  estimateRetentionCleanup: { domain: "category", access: "read", permission: "category.manage", run: categories.estimateRetentionCleanup },
  listPlatformJobs: { domain: "category", access: "read", permission: "category.manage", run: categories.listPlatformJobs },
  savePlatformSettings: { domain: "category", access: "admin", permission: "category.manage", run: categories.savePlatformSettings },
  saveCategoryManagement: { domain: "category", access: "admin", permission: "category.manage", run: categories.saveCategoryManagement },
  savePlatformFeatures: { domain: "category", access: "admin", permission: "category.manage", run: categories.savePlatformFeatures },
  completeInitialSetup: { domain: "category", access: "participation", run: categories.completeInitialSetup },
  getContentVersions: { domain: "content", access: "read", run: contentVersions.getContentVersions },
  getSessionBootstrap: { domain: "user", access: "read", run: getSessionBootstrap },
  getCurrentUserRole: { domain: "user", access: "read", run: users.getCurrentUserRole },
  listRoleAssignments: { domain: "user", access: "read", permission: "role.manage", run: userAccess.listRoleAssignments },
  listAdminUsers: { domain: "user", access: "read", permission: "role.manage", run: userAdmin.listAdminUsers },
  listAdminAudit: { domain: "user", access: "read", permission: "role.manage", run: userAdmin.listAdminAudit },
  listAdminActivity: { domain: "user", access: "read", permission: "dashboard.view", run: userAdmin.listAdminActivity },
  getAdminOverview: { domain: "user", access: "read", permission: "dashboard.view", run: userAdmin.getAdminOverview },
  listAccountAccessRules: { domain: "user", access: "read", permission: "role.manage", run: accessRules.listAccountAccessRules },
  previewAccountAccessRule: { domain: "user", access: "read", permission: "role.manage", run: accessRules.previewAccountAccessRule },
  saveAccountAccessRule: { domain: "user", access: "admin", permission: "role.manage", run: accessRules.saveAccountAccessRule },
  deleteAccountAccessRule: { domain: "user", access: "admin", permission: "role.manage", run: accessRules.deleteAccountAccessRule },
  setUserAccessScope: { domain: "user", access: "admin", permission: "role.manage", run: userAccess.setUserAccessScope },
  saveScopeMembers: { domain: "user", access: "admin", permission: "role.manage", run: userAccess.saveScopeMembers },
  cacheUserAvatar: { domain: "user", access: "personal", run: users.cacheUserAvatar },
  getUserPublicProfiles: { domain: "user", access: "read", run: users.getUserPublicProfiles },
  createImageUploadSessions: { domain: "upload", access: "participation", run: (input, auth, database) => handleUploadAction("createImageUploadSessions", input, auth, database) },
  finalizeImageUploads: { domain: "upload", access: "participation", run: (input, auth, database) => handleUploadAction("finalizeImageUploads", input, auth, database) },
  deleteUploadedImages: { domain: "upload", access: "participation", run: (input, auth, database) => handleUploadAction("deleteUploadedImages", input, auth, database) },
  resolveUploadImageUrls: { domain: "upload", access: "read", run: (input, auth, database) => handleUploadAction("resolveUploadImageUrls", input, auth, database) },
  getIssue: { domain: "issue", access: "read", run: (input, auth, database) => handleIssueAction("getIssue", input, auth, database) },
  listIssues: { domain: "issue", access: "read", run: (input, auth, database) => handleIssueAction("listIssues", input, auth, database) },
  listIssueSupporters: { domain: "issue", access: "read", run: (input, auth, database) => handleIssueAction("listIssueSupporters", input, auth, database) },
  searchIssues: { domain: "issue", access: "read", run: (input, auth, database) => handleIssueAction("searchIssues", input, auth, database) },
  listUserIssues: { domain: "issue", access: "read", run: (input, auth, database) => handleIssueAction("listUserIssues", input, auth, database) },
  createIssue: { domain: "issue", access: "participation", run: (input, auth, database) => handleIssueAction("createIssue", input, auth, database) },
  moderateIssueStatus: { domain: "issue", access: "admin", permission: "proposal.manage", run: (input, auth, database) => handleIssueAction("moderateIssueStatus", input, auth, database) },
  updateIssueResult: { domain: "issue", access: "admin", permission: "proposal.manage", run: (input, auth, database) => handleIssueAction("updateIssueResult", input, auth, database) },
  toggleSupport: { domain: "issue", access: "reaction", run: (input, auth, database) => handleIssueAction("toggleSupport", input, auth, database) },
  removeSupport: { domain: "issue", access: "reaction", run: (input, auth, database) => handleIssueAction("removeSupport", input, auth, database) },
  deleteIssue: { domain: "issue", access: "participation", moderatedBy: "proposal.manage", run: (input, auth, database) => handleIssueAction("deleteIssue", input, auth, database) },
  listComments: { domain: "issue", access: "read", run: (input, auth, database) => handleIssueAction("listComments", input, auth, database) },
  createComment: { domain: "issue", access: "participation", run: (input, auth, database) => handleIssueAction("createComment", input, auth, database) },
  deleteComment: { domain: "issue", access: "participation", moderatedBy: "proposal.manage", run: (input, auth, database) => handleIssueAction("deleteComment", input, auth, database) },
  listFacilities: { domain: "facility", access: "read", run: facilities.listFacilities },
  getFacility: { domain: "facility", access: "read", run: facilities.getFacility },
  createFacility: { domain: "facility", access: "participation", run: facilities.createFacility },
  toggleFacilityAffected: { domain: "facility", access: "reaction", run: facilities.toggleFacilityAffected },
  updateFacilityStatus: { domain: "facility", access: "admin", run: facilities.updateFacilityStatus },
  deleteFacility: { domain: "facility", access: "participation", moderatedBy: "facility.manage", run: facilities.deleteFacility },
  listAnnouncements: { domain: "announcement", access: "read", run: (input, auth, database) => handleAnnouncementAction("listAnnouncements", input, auth, database) },
  getAnnouncement: { domain: "announcement", access: "read", run: (input, auth, database) => handleAnnouncementAction("getAnnouncement", input, auth, database) },
  getAnnouncementUnreadHint: { domain: "announcement", access: "read", run: (input, auth, database) => handleAnnouncementAction("getAnnouncementUnreadHint", input, auth, database) },
  markAnnouncementsOpened: { domain: "announcement", access: "personal", run: (input, auth, database) => handleAnnouncementAction("markAnnouncementsOpened", input, auth, database) },
  createAnnouncement: { domain: "announcement", access: "admin", permission: "announcement.manage", run: (input, auth, database) => handleAnnouncementAction("createAnnouncement", input, auth, database) },
  deleteAnnouncement: { domain: "announcement", access: "admin", moderatedBy: "announcement.manage", permission: "announcement.manage", run: (input, auth, database) => handleAnnouncementAction("deleteAnnouncement", input, auth, database) },
  setAnnouncementLike: { domain: "announcement", access: "reaction", run: (input, auth, database) => handleAnnouncementAction("setAnnouncementLike", input, auth, database) },
  listAnnouncementComments: { domain: "announcement", access: "read", run: (input, auth, database) => handleAnnouncementAction("listAnnouncementComments", input, auth, database) },
  createAnnouncementComment: { domain: "announcement", access: "participation", run: (input, auth, database) => handleAnnouncementAction("createAnnouncementComment", input, auth, database) },
  deleteAnnouncementComment: { domain: "announcement", access: "participation", moderatedBy: "announcement.manage", run: (input, auth, database) => handleAnnouncementAction("deleteAnnouncementComment", input, auth, database) },
  listNotificationPages: { domain: "notification", access: "read", run: notifications.listNotificationPages },
  getNotificationSnapshot: { domain: "notification", access: "read", run: notifications.getNotificationSnapshot },
  getNotificationReadState: { domain: "notification", access: "read", run: notifications.getNotificationReadState },
  getNotificationUnreadHint: { domain: "notification", access: "read", run: notifications.getNotificationUnreadHint },
  markNotificationsOpened: { domain: "notification", access: "personal", run: notifications.markNotificationsOpened },
  getPushNotificationPreference: { domain: "notification", access: "read", run: notifications.getPushNotificationPreference },
  getPlatformAdminNotificationPreferences: { domain: "notification", access: "read", run: notifications.getPlatformAdminNotificationPreferences },
  registerPushToken: { domain: "notification", access: "personal", run: notifications.registerPushToken },
  unregisterPushToken: { domain: "notification", access: "personal", run: notifications.unregisterPushToken },
  updatePlatformAdminNotificationPreferences: { domain: "notification", access: "personal", run: notifications.updatePlatformAdminNotificationPreferences },
  getPlatformDashboard: { domain: "dashboard", access: "read", permission: "dashboard.view", run: dashboard.getPlatformDashboard },
};
