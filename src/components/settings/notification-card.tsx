"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import { Bell } from "lucide-react";
import type {
  PersonalPushPreferenceKey,
  PushNotificationPermission,
} from "@/hooks/use-push-notifications";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActionFeedbackIcon } from "@/components/ui/action-feedback-icon";
import { Switch } from "@/components/ui/switch";

export interface NotificationOption {
  description: string;
  key: PersonalPushPreferenceKey;
  label: string;
}

export type NotificationFeedbackTarget =
  | "device"
  | PersonalPushPreferenceKey;

export function NotificationCard({
  enabled,
  feedbackState,
  feedbackTarget,
  loading,
  onEnabledChange,
  onPreferenceChange,
  options,
  permission,
  preferences,
  supported,
}: {
  enabled: boolean;
  feedbackState: "idle" | "loading" | "success";
  feedbackTarget: NotificationFeedbackTarget | null;
  loading: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onPreferenceChange: (
    key: PersonalPushPreferenceKey,
    enabled: boolean,
  ) => void;
  options: NotificationOption[];
  permission: PushNotificationPermission;
  preferences: Record<PersonalPushPreferenceKey, boolean>;
  supported: boolean;
}) {
  useLocaleSubscription();
  const status =
    permission === "denied"
      ? translate('ui.settings.pushBlocked')
      : supported
        ? translate('ui.settings.pushReady')
        : translate('ui.settings.pushUnsupported');
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="pb-1 pt-5">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="size-4 text-muted-foreground" />{translate('ui.settings.push')}</CardTitle>
      </CardHeader>
      <CardContent className="divide-y p-0">
        <PreferenceRow
          checked={enabled}
          description={status}
          disabled={loading || !supported || permission === "denied"}
          feedbackState={feedbackTarget === "device" ? feedbackState : "idle"}
          label={translate('ui.settings.pushDevice')}
          onCheckedChange={onEnabledChange}
        />
        {options.map((option) => (
          <PreferenceRow
            checked={preferences[option.key]}
            description={option.description}
            disabled={loading}
            feedbackState={feedbackTarget === option.key ? feedbackState : "idle"}
            key={option.key}
            label={option.label}
            onCheckedChange={(value) => onPreferenceChange(option.key, value)}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function PreferenceRow({
  checked,
  description,
  disabled,
  feedbackState,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  description: string;
  disabled: boolean;
  feedbackState: "idle" | "loading" | "success";
  label: string;
  onCheckedChange: (enabled: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 px-5 py-4">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">
          {description}
        </span>
      </span>
      {feedbackState === "idle" ? (
        <Switch
          checked={checked}
          disabled={disabled}
          onCheckedChange={onCheckedChange}
        />
      ) : (
        <span
          aria-label={
            feedbackState === "success"
              ? translate("notification.notificationSettingsSaved")
              : translate("notification.savingNotificationSettings")
          }
          className="grid w-8 shrink-0 place-items-center"
          role="status"
        >
          <ActionFeedbackIcon
            size="md"
            state={feedbackState === "success" ? "success" : "loading"}
          />
        </span>
      )}
    </label>
  );
}
