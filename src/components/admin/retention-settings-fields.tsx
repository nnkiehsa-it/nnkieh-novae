"use client";

import { PlatformNumberSetting } from "@/components/admin/platform-number-setting";
import { CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ResizableCard } from "@/components/ui/resizable-card";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n";
import type { DataRetentionSettings } from "@/types/categories";

type RetentionKey = keyof DataRetentionSettings;
type RetentionItem = {
  enableKey?: RetentionKey;
  key: RetentionKey;
  unit: "days" | "hours";
};

const GROUPS: Array<{ descriptionKey: string; items: RetentionItem[]; titleKey: string }> = [
  {
    descriptionKey: "ui.admin.retentionContentHelp",
    items: [
      { enableKey: "closedIssuesEnabled", key: "closedIssuesDays", unit: "days" },
      { enableKey: "closedFacilitiesEnabled", key: "closedFacilitiesDays", unit: "days" },
      { enableKey: "announcementsEnabled", key: "announcementsDays", unit: "days" },
      { enableKey: "notificationsEnabled", key: "notificationsDays", unit: "days" },
    ],
    titleKey: "ui.admin.retentionContent",
  },
  {
    descriptionKey: "ui.admin.retentionPrivacyHelp",
    items: [
      { enableKey: "inactiveAvatarsEnabled", key: "inactiveAvatarsDays", unit: "days" },
      { enableKey: "inactiveProfilePiiEnabled", key: "inactiveProfilePiiDays", unit: "days" },
      { enableKey: "expiredRestrictionsEnabled", key: "expiredRestrictionsDays", unit: "days" },
      { key: "inactivePushTokensDays", unit: "days" },
      { key: "pushTokenConfirmationDays", unit: "days" },
    ],
    titleKey: "ui.admin.retentionPrivacy",
  },
  {
    descriptionKey: "ui.admin.retentionOperationsHelp",
    items: [
      { key: "deliveryCompletedDays", unit: "days" },
      { key: "deliveryFailedDays", unit: "days" },
      { key: "operationHours", unit: "hours" },
      { key: "backgroundJobCompletedDays", unit: "days" },
      { key: "backgroundJobFailedDays", unit: "days" },
    ],
    titleKey: "ui.admin.retentionOperations",
  },
  {
    descriptionKey: "ui.admin.retentionAuditHelp",
    items: [
      { key: "roleAssignmentAuditDays", unit: "days" },
      { key: "adminAuditDays", unit: "days" },
      { key: "categoryConfigurationAuditDays", unit: "days" },
      { key: "accessAssignmentAuditDays", unit: "days" },
    ],
    titleKey: "ui.admin.retentionAudit",
  },
  {
    descriptionKey: "ui.admin.retentionUploadsHelp",
    items: [
      { key: "pendingUploadHours", unit: "hours" },
      { key: "unattachedUploadHours", unit: "hours" },
      { key: "failedUploadHours", unit: "hours" },
    ],
    titleKey: "ui.admin.retentionUploads",
  },
];

export function RetentionSettingsFields({
  onChange,
  retention,
}: {
  onChange: (key: RetentionKey, value: boolean | number) => void;
  retention: DataRetentionSettings;
}) {
  const { t } = useI18n();
  return GROUPS.map((group) => (
    <ResizableCard className="gap-0 py-0" key={group.titleKey}>
      <CardContent className="grid gap-5 px-5 py-6 sm:px-7">
        <div>
          <h2 className="text-sm font-semibold">{t(group.titleKey)}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t(group.descriptionKey)}</p>
        </div>
        <div className="grid gap-4">
          {group.items.map((item, index) => {
            const enabled = item.enableKey ? retention[item.enableKey] === true : true;
            return (
              <div className={index > 0 ? "border-t pt-4" : ""} key={item.key}>
                {item.enableKey ? (
                  <div className="mb-3 flex items-center justify-between gap-4">
                    <Label htmlFor={`retention-${item.enableKey}`}>{t(`ui.admin.retention.${item.enableKey}`)}</Label>
                    <Switch
                      checked={enabled}
                      id={`retention-${item.enableKey}`}
                      onCheckedChange={(value) => onChange(item.enableKey as RetentionKey, value)}
                    />
                  </div>
                ) : null}
                {enabled ? (
                  <PlatformNumberSetting
                    label={t(`ui.admin.retention.${item.key}`)}
                    max={item.unit === "hours" ? 87_600 : 3_650}
                    onChange={(value) => onChange(item.key, value)}
                    value={retention[item.key] as number}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </CardContent>
    </ResizableCard>
  ));
}
