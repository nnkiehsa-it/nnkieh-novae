import * as v from "valibot";
import { action, type ActionSpec } from "./contract.ts";
import { FACILITY_ACTIONS } from "./contracts/facilities.ts";
import { USER_ACTIONS } from "./contracts/users.ts";
import { NOTIFICATION_ACTIONS } from "./contracts/notifications.ts";

/** An action whose contract has not been written yet: it accepts any object and promises nothing. */
function pending(spec: Omit<ActionSpec, "input" | "output">) {
  return action({ ...spec, input: v.record(v.string(), v.unknown()), output: v.unknown() });
}

/** Every backend action. The Worker registers exactly these, and the client can call nothing else. */
export const ACTIONS = {
  ...FACILITY_ACTIONS,
  ...USER_ACTIONS,
  ...NOTIFICATION_ACTIONS,
  getRuntimePolicies: pending({ group: "read" }),
  getProviderDiagnostics: pending({ group: "read" }),
  rebuildNotionArchive: pending({ group: "admin-write", extraLimit: "destructiveWriteHourly" }),
  clearOperationalErrors: pending({ group: "admin-write", extraLimit: "destructiveWriteHourly" }),
  clearScheduledWork: pending({ group: "admin-write", extraLimit: "destructiveWriteHourly" }),
  retryOperationalWork: pending({ group: "admin-write", extraLimit: "destructiveWriteHourly" }),
  getOperationsConsole: pending({ group: "read" }),
  saveOperationPolicies: pending({ group: "admin-write", extraLimit: "roleWriteHourly" }),
  completeInitialSetup: pending({ group: "admin-write", extraLimit: "roleWriteHourly" }),
  createAnnouncement: pending({ group: "admin-write", extraLimit: "announcementCreateDaily" }),
  createAnnouncementComment: pending({ group: "sensitive-write", extraLimit: "commentCreateHourly" }),
  createComment: pending({ group: "sensitive-write", extraLimit: "commentCreateHourly" }),
  createImageUploadSessions: pending({ group: "upload-write", extraLimit: "imageUploadDaily" }),
  createIssue: pending({ group: "sensitive-write", extraLimit: "issueCreateDaily" }),
  deleteAnnouncement: pending({ group: "admin-write", extraLimit: "destructiveWriteHourly" }),
  deleteAnnouncementComment: pending({ group: "sensitive-write", extraLimit: "destructiveWriteHourly" }),
  deleteComment: pending({ group: "sensitive-write", extraLimit: "destructiveWriteHourly" }),
  deleteIssue: pending({ group: "admin-write", extraLimit: "destructiveWriteHourly" }),
  deleteUploadedImages: pending({ group: "upload-write", extraLimit: "destructiveWriteHourly" }),
  estimateCategoryPolicyChanges: pending({ group: "read" }),
  estimateRetentionCleanup: pending({ group: "read" }),
  finalizeImageUploads: pending({ group: "upload-write" }),
  getAnnouncement: pending({ group: "read" }),
  getAnnouncementUnreadHint: pending({ group: "read" }),
  getCategoryCatalog: pending({ group: "read" }),
  getCategoryManagement: pending({ group: "read" }),
  getContentVersions: pending({ group: "read" }),
  getSessionBootstrap: pending({ group: "read" }),
  getIssue: pending({ group: "read" }),
  getPlatformDashboard: pending({ group: "read" }),
  listAnnouncementComments: pending({ group: "read" }),
  listAnnouncements: pending({ group: "read" }),
  listComments: pending({ group: "read" }),
  listIssues: pending({ group: "read" }),
  listIssueSupporters: pending({ group: "read" }),
  listPlatformJobs: pending({ group: "read" }),
  listUserIssues: pending({ group: "read" }),
  markAnnouncementsOpened: pending({ group: "general-write" }),
  moderateIssueStatus: pending({ group: "admin-write", extraLimit: "moderationWriteHourly" }),
  removeSupport: pending({ group: "sensitive-write", extraLimit: "supportToggleHourly" }),
  resolveUploadImageUrls: pending({ group: "upload-resolve" }),
  searchIssues: pending({ group: "read" }),
  saveCategoryManagement: pending({ group: "admin-write", extraLimit: "roleWriteHourly" }),
  savePlatformSettings: pending({ group: "admin-write", extraLimit: "roleWriteHourly" }),
  savePlatformFeatures: pending({ group: "admin-write", extraLimit: "roleWriteHourly" }),
  setAnnouncementLike: pending({ group: "sensitive-write", extraLimit: "announcementLikeHourly" }),
  toggleSupport: pending({ group: "sensitive-write", extraLimit: "supportToggleHourly" }),
  updateIssueResult: pending({ group: "admin-write", extraLimit: "moderationWriteHourly" }),
} satisfies Record<string, ActionSpec>;

export type ActionName = keyof typeof ACTIONS;
export type ActionInput<N extends ActionName> = v.InferOutput<(typeof ACTIONS)[N]["input"]>;
/** What a caller passes: defaults the schema fills in may be left out. */
export type ActionRequest<N extends ActionName> = v.InferInput<(typeof ACTIONS)[N]["input"]>;
export type ActionOutput<N extends ActionName> = v.InferOutput<(typeof ACTIONS)[N]["output"]>;
