/**
 * Message keys for the recorded action names and the fields inside their detail.
 * Retired actions keep their labels: the audit log still holds what they did.
 */
export const ACTION_LABELS: Record<string, string> = {
  saveOperationPolicies: "admin.auditSavePolicies",
  retryOperationalWork: "admin.auditRetryWork",
  clearOperationalErrors: "ui.adminConsole.actionClearOperationalErrors",
  clearScheduledWork: "ui.adminConsole.actionClearScheduledWork",
  rebuildNotionArchive: "ui.adminConsole.actionRebuildNotion",
  createAnnouncement: "ui.adminConsole.actionCreateAnnouncement",
  deleteAnnouncement: "ui.adminConsole.actionDeleteAnnouncement",
  deleteFacility: "ui.adminConsole.actionDeleteFacility",
  deleteIssue: "ui.adminConsole.actionDeleteIssue",
  moderateIssueStatus: "ui.adminConsole.actionModerateIssue",
  saveCategoryManagement: "ui.adminConsole.actionSaveCategories",
  savePlatformFeatures: "ui.adminConsole.actionSaveFeatures",
  savePlatformSettings: "ui.adminConsole.actionSaveSettings",
  setUserAccessScope: "ui.adminConsole.actionSetAccess",
  saveScopeMembers: "ui.adminConsole.actionSetAccess",
  saveAccountAccessRule: "admin.auditSaveRestriction",
  deleteAccountAccessRule: "admin.auditDeleteRestriction",
  updateFacilityStatus: "ui.adminConsole.actionUpdateFacility",
  updateIssueResult: "ui.adminConsole.actionUpdateIssue",
};

export const DETAIL_LABELS: Record<string, string> = {
  changes: "admin.auditMemberChanges",
  scopeKind: "ui.access.scopeType",
  grant: "ui.access.grant",
  imageUploads: "ui.adminConsole.detailImageSettings",
  retention: "ui.adminConsole.detailRetentionConfig",
  targetType: "ui.accountAccess.ruleSource",
  targetValue: "ui.adminConsole.targetColumn",
  preset: "ui.adminConsole.detailMode",
  duration: "ui.accountAccess.durationLabel",
  message: "ui.accountAccess.messageLabel",
  announcementMaxImages: "ui.admin.announcementImageLimit",
  announcementCommentMaxImages: "ui.admin.commentImageLimit",
  announcementCommentsEnabled: "ui.adminConsole.detailAnnouncementComments",
  announcementId: "ui.adminConsole.detailAnnouncementId",
  categoryId: "ui.adminConsole.detailCategoryId",
  commentId: "ui.adminConsole.detailCommentId",
  durationHours: "ui.adminConsole.detailDurationHours",
  facilitiesEnabled: "ui.adminConsole.detailFacilitiesEnabled",
  facilityCategories: "ui.adminConsole.detailFacilityCategories",
  facilityId: "ui.adminConsole.detailFacilityId",
  id: "ui.adminConsole.detailJobId",
  imageSettings: "ui.adminConsole.detailImageSettings",
  issueCategories: "ui.adminConsole.detailIssueCategories",
  issueId: "ui.adminConsole.detailIssueId",
  issuesEnabled: "ui.adminConsole.detailIssuesEnabled",
  kind: "ui.adminConsole.detailJobKind",
  mode: "ui.adminConsole.detailMode",
  nextStatus: "ui.adminConsole.detailNextStatus",
  reason: "ui.adminConsole.detailReason",
  retentionConfig: "ui.adminConsole.detailRetentionConfig",
  reviewRejectionReason: "ui.adminConsole.detailReviewReason",
  revision: "ui.adminConsole.detailRevision",
  status: "ui.adminConsole.detailStatus",
  supportDeadlineAt: "ui.adminConsole.detailSupportDeadline",
  targetUid: "ui.adminConsole.detailUserId",
  uid: "ui.adminConsole.detailUserId",
  values: "ui.adminConsole.detailSettings",
};

/** The fields of a category, which appear inside the recorded category lists. */
export const CATEGORY_FIELD_LABELS: Record<string, string> = {
  label: "ui.common.name",
  id: "ui.common.slug",
  readAccess: "ui.admin.readAccess",
  authorVisible: "ui.admin.showAuthor",
  authorDeleteEnabled: "admin.auditAuthorDelete",
  commentsEnabled: "ui.admin.allowComments",
  supportEnabled: "ui.admin.enableSupport",
  supportGoal: "ui.admin.supportGoal",
  supportDeadlineDays: "ui.admin.supportDays",
  maxImages: "admin.contentImageLimit",
  commentMaxImages: "ui.admin.commentImageLimit",
  isDefault: "ui.admin.defaultCategory",
  sortOrder: "admin.categoryOrder",
};

export const SCOPE_KIND_LABELS: Record<string, string> = {
  issue: "ui.access.issueCategory",
  facility: "ui.access.facilityCategory",
  announcement: "ui.access.announcementManagement",
};

export const TARGET_TYPE_LABELS: Record<string, string> = {
  uid: "ui.accountAccess.source.uid",
  email_prefix: "ui.accountAccess.prefixLabel",
};
