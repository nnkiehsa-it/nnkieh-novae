import type { DataRetentionSettings } from "@/types/categories";

export type RetentionKey = keyof DataRetentionSettings;

export interface RetentionItem {
  enableKey?: RetentionKey;
  key: RetentionKey;
  unit: "days" | "hours";
}

export function retentionLabelKey(key: string) {
  return `ui.admin.retention.${key}`;
}

/**
 * Retention read as five decisions rather than twenty fields: what to keep of
 * what people wrote, what to stop keeping about them, what the machinery leaves
 * behind, what the audit trail owes, and what an abandoned upload costs.
 */
export const RETENTION_GROUPS: ReadonlyArray<{
  items: RetentionItem[];
  titleKey: string;
  value: string;
  detailKey: string;
}> = [
  {
    items: [
      { enableKey: "closedIssuesEnabled", key: "closedIssuesDays", unit: "days" },
      { enableKey: "closedFacilitiesEnabled", key: "closedFacilitiesDays", unit: "days" },
      { enableKey: "announcementsEnabled", key: "announcementsDays", unit: "days" },
      { enableKey: "notificationsEnabled", key: "notificationsDays", unit: "days" },
    ],
    titleKey: "ui.admin.retentionContent",
    value: "retention-content", detailKey: "admin.summary.retentionContent",
  },
  {
    items: [
      { enableKey: "inactiveAvatarsEnabled", key: "inactiveAvatarsDays", unit: "days" },
      { enableKey: "inactiveProfilePiiEnabled", key: "inactiveProfilePiiDays", unit: "days" },
      { enableKey: "expiredRestrictionsEnabled", key: "expiredRestrictionsDays", unit: "days" },
      { key: "inactivePushTokensDays", unit: "days" },
      { key: "pushTokenConfirmationDays", unit: "days" },
    ],
    titleKey: "ui.admin.retentionPrivacy",
    value: "retention-privacy", detailKey: "admin.summary.retentionPrivacy",
  },
  {
    items: [
      { key: "deliveryCompletedDays", unit: "days" },
      { key: "deliveryFailedDays", unit: "days" },
      { key: "operationHours", unit: "hours" },
      { key: "domainEventDays", unit: "days" },
      { key: "backgroundJobCompletedDays", unit: "days" },
      { key: "backgroundJobFailedDays", unit: "days" },
    ],
    titleKey: "ui.admin.retentionOperations",
    value: "retention-operations", detailKey: "admin.summary.retentionOperations",
  },
  {
    items: [
      { key: "roleAssignmentAuditDays", unit: "days" },
      { key: "adminAuditDays", unit: "days" },
      { key: "categoryConfigurationAuditDays", unit: "days" },
      { key: "accessAssignmentAuditDays", unit: "days" },
    ],
    titleKey: "ui.admin.retentionAudit",
    value: "retention-audit", detailKey: "admin.summary.retentionAudit",
  },
  {
    items: [
      { key: "pendingUploadHours", unit: "hours" },
      { key: "unattachedUploadHours", unit: "hours" },
      { key: "failedUploadHours", unit: "hours" },
    ],
    titleKey: "ui.admin.retentionUploads",
    value: "retention-uploads", detailKey: "admin.summary.retentionUploads",
  },
];
