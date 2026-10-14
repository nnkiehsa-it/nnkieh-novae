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
import * as uploads from "./uploads.ts";
import * as issueRead from "./issue-read.ts";
import * as issueWrite from "./issue-write.ts";
import * as issueComments from "./issue-comments.ts";
import * as facilities from "./facilities.ts";
import * as announcements from "./announcements.ts";
import * as announcementComments from "./announcement-comments.ts";
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
  createImageUploadSessions: { domain: "upload", access: "participation", run: uploads.createImageUploadSessions },
  finalizeImageUploads: { domain: "upload", access: "participation", run: uploads.finalizeImageUploads },
  deleteUploadedImages: { domain: "upload", access: "participation", run: uploads.deleteUploadedImages },
  resolveUploadImageUrls: { domain: "upload", access: "read", run: uploads.resolveUploadImageUrls },
  getIssue: { domain: "issue", access: "read", run: issueRead.getIssue },
  listIssues: { domain: "issue", access: "read", run: issueRead.listIssues },
  listIssueSupporters: { domain: "issue", access: "read", run: issueRead.listIssueSupporters },
  searchIssues: { domain: "issue", access: "read", run: issueRead.searchIssues },
  listUserIssues: { domain: "issue", access: "read", run: issueRead.listUserIssues },
  createIssue: { domain: "issue", access: "participation", run: issueWrite.createIssue },
  moderateIssueStatus: { domain: "issue", access: "admin", permission: "proposal.manage", run: issueWrite.moderateIssueStatus },
  updateIssueResult: { domain: "issue", access: "admin", permission: "proposal.manage", run: issueWrite.updateIssueResult },
  toggleSupport: { domain: "issue", access: "reaction", run: issueWrite.toggleSupport },
  removeSupport: { domain: "issue", access: "reaction", run: issueWrite.removeSupport },
  deleteIssue: { domain: "issue", access: "participation", moderatedBy: "proposal.manage", run: issueWrite.deleteIssue },
  listComments: { domain: "issue", access: "read", run: issueComments.listComments },
  createComment: { domain: "issue", access: "participation", run: issueComments.createComment },
  deleteComment: { domain: "issue", access: "participation", moderatedBy: "proposal.manage", run: issueComments.deleteComment },
  listFacilities: { domain: "facility", access: "read", run: facilities.listFacilities },
  getFacility: { domain: "facility", access: "read", run: facilities.getFacility },
  createFacility: { domain: "facility", access: "participation", run: facilities.createFacility },
  toggleFacilityAffected: { domain: "facility", access: "reaction", run: facilities.toggleFacilityAffected },
  updateFacilityStatus: { domain: "facility", access: "admin", run: facilities.updateFacilityStatus },
  deleteFacility: { domain: "facility", access: "participation", moderatedBy: "facility.manage", run: facilities.deleteFacility },
  listAnnouncements: { domain: "announcement", access: "read", run: announcements.listAnnouncements },
  getAnnouncement: { domain: "announcement", access: "read", run: announcements.getAnnouncement },
  getAnnouncementUnreadHint: { domain: "announcement", access: "read", run: announcements.getAnnouncementUnreadHint },
  markAnnouncementsOpened: { domain: "announcement", access: "personal", run: announcements.markAnnouncementsOpened },
  createAnnouncement: { domain: "announcement", access: "admin", permission: "announcement.manage", run: announcements.createAnnouncement },
  deleteAnnouncement: { domain: "announcement", access: "admin", moderatedBy: "announcement.manage", permission: "announcement.manage", run: announcements.deleteAnnouncement },
  setAnnouncementLike: { domain: "announcement", access: "reaction", run: announcements.setAnnouncementLike },
  listAnnouncementComments: { domain: "announcement", access: "read", run: announcementComments.listAnnouncementComments },
  createAnnouncementComment: { domain: "announcement", access: "participation", run: announcementComments.createAnnouncementComment },
  deleteAnnouncementComment: { domain: "announcement", access: "participation", moderatedBy: "announcement.manage", run: announcementComments.deleteAnnouncementComment },
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
