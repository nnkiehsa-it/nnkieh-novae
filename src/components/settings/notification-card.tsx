"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import type {
  PlatformAdminNotificationPreferenceKey,
  PlatformAdminNotificationPreferences,
  PushNotificationPermission,
} from "@/hooks/use-push-notifications";
import { ActionFeedbackIcon } from "@/components/ui/action-feedback-icon";
import { ListCustomRow, ListSection, RowInner } from "@/components/ui/list";
import { ListSwitchRow } from "@/components/ui/list-controls";

export interface NotificationOption {
  key: PlatformAdminNotificationPreferenceKey;
  label: string;
}

export function NotificationCard({
  deviceFeedbackState,
  enabled,
  loading,
  onEnabledChange,
  permission,
  supported,
}: {
  deviceFeedbackState: "idle" | "loading" | "success";
  enabled: boolean;
  loading: boolean;
  onEnabledChange: (enabled: boolean) => void;
  permission: PushNotificationPermission;
  supported: boolean;
}) {
  useLocaleSubscription();
  const status =
    permission === "denied"
      ? translate("ui.settings.pushBlocked")
      : supported
        ? translate("ui.settings.pushReady")
        : translate("ui.settings.pushUnsupported");
  return (
    <ListSection
      header={translate("ui.settings.push")}
    >
      {/* Turning the device on has to happen in the click that asked for it:
          the browser only offers the permission prompt inside that gesture, so
          this one switch acts immediately while the preferences below wait. */}
      {deviceFeedbackState === "idle" ? (
        <ListSwitchRow
          checked={enabled}
          detail={status}
          disabled={loading || !supported || permission === "denied"}
          label={translate("ui.settings.pushDevice")}
          name={translate("ui.settings.pushDevice")}
          onCheckedChange={onEnabledChange}
        />
      ) : (
        <ListCustomRow>
          <RowInner
            detail={status}
            label={translate("ui.settings.pushDevice")}
            trailing={
              <span
                aria-label={
                  deviceFeedbackState === "success"
                    ? translate("notification.notificationSettingsSaved")
                    : translate("notification.savingNotificationSettings")
                }
                className="grid w-8 shrink-0 place-items-center"
                role="status"
              >
                <ActionFeedbackIcon
                  size="md"
                  state={deviceFeedbackState === "success" ? "success" : "loading"}
                />
              </span>
            }
          />
        </ListCustomRow>
      )}
    </ListSection>
  );
}

export function PlatformAdminNotificationCard({
  onPreferenceChange,
  options,
  preferences,
}: {
  onPreferenceChange: (key: PlatformAdminNotificationPreferenceKey, enabled: boolean) => void;
  options: NotificationOption[];
  preferences: PlatformAdminNotificationPreferences;
}) {
  useLocaleSubscription();
  return (
    <ListSection header={translate("ui.settings.platformAdminNotifications")}>
      {options.map((option) => (
        <ListSwitchRow
          checked={preferences[option.key]}
          key={option.key}
          label={option.label}
          name={option.label}
          onCheckedChange={(value) => onPreferenceChange(option.key, value)}
        />
      ))}
    </ListSection>
  );
}
