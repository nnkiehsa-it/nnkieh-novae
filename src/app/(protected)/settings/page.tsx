"use client";
import { t as translate } from "@/i18n";

import * as React from "react";
import { LogOut } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { useSession } from "@/hooks/use-session";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import { setLocale, useI18n } from "@/i18n";
import { SettingsAccountCard } from "@/components/settings/account-card";
import { AppearanceInstallCards } from "@/components/settings/appearance-install-cards";
import {
  NotificationCard,
  type NotificationFeedbackTarget,
  type NotificationOption,
} from "@/components/settings/notification-card";
import {
  ManagementLinks,
  ResourceLinks,
} from "@/components/settings/settings-links";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-state";
import { useActionFeedback } from "@/hooks/use-action-feedback";

export default function SettingsPage() {
  const session = useSession();
  const push = usePushNotifications();
  const pwa = usePwaInstall();
  const { locale } = useI18n();
  const { resolvedTheme, setTheme, theme } = useTheme();
  const notificationFeedback = useActionFeedback();
  const [notificationFeedbackTarget, setNotificationFeedbackTarget] =
    React.useState<NotificationFeedbackTarget | null>(null);
  const user = session.user!;
  const notificationOptions: NotificationOption[] = [
    {
      description: translate("ui.settings.commentDescription"),
      key: "comments",
      label: translate("ui.settings.commentLabel"),
    },
    {
      description: translate("ui.settings.issueDescription"),
      key: "issueUpdates",
      label: translate("ui.settings.issueLabel"),
    },
    {
      description: translate("ui.settings.facilityDescription"),
      key: "facilityUpdates",
      label: translate("ui.settings.facilityLabel"),
    },
  ];

  async function togglePush(enabled: boolean) {
    setNotificationFeedbackTarget("device");
    try {
      await notificationFeedback.run(async () => {
        const ok = enabled ? await push.enable() : await push.disable();
        if (!ok) throw new Error(translate("ui.settings.pushUpdateFailed"));
      });
    } catch (caught) {
      toast.error(
        caught instanceof Error
          ? caught.message
          : translate("ui.settings.pushUpdateFailed"),
      );
    } finally {
      setNotificationFeedbackTarget(null);
    }
  }

  async function setPreference(
    key: NotificationOption["key"],
    enabled: boolean,
  ) {
    setNotificationFeedbackTarget(key);
    try {
      await notificationFeedback.run(async () => {
        const ok = await push.setPreference(key, enabled);
        if (!ok) throw new Error(translate("ui.common.updateFailed"));
      });
    } catch (caught) {
      toast.error(
        caught instanceof Error
          ? caught.message
          : translate("ui.common.updateFailed"),
      );
    } finally {
      setNotificationFeedbackTarget(null);
    }
  }

  return (
    <div className="w-full space-y-5">
      <PageHeader
        title={translate('ui.nav.settings')}
      />
      <SettingsAccountCard
        customPhotoUrl={session.customPhotoUrl}
        onCopyUid={() =>
          void navigator.clipboard
            .writeText(user.uid)
            .then(() => toast.success(translate('ui.settings.uidCopied')))
        }
        onSwitchAccount={() => void session.login({ selectAccount: true })}
        user={user}
      />
      <AppearanceInstallCards
        canInstall={pwa.canInstall}
        installed={pwa.installed}
        locale={locale}
        onInstall={() =>
          void pwa.install().then((ok) => ok && toast.success(translate('ui.settings.installStarted')))
        }
        onLocaleChange={setLocale}
        onThemeChange={setTheme}
        resolvedTheme={resolvedTheme}
        theme={theme}
      />
      <NotificationCard
        enabled={push.enabled}
        feedbackState={notificationFeedback.state}
        feedbackTarget={notificationFeedbackTarget}
        loading={push.loading}
        onEnabledChange={(enabled) => void togglePush(enabled)}
        onPreferenceChange={(key, enabled) => void setPreference(key, enabled)}
        options={notificationOptions}
        permission={push.permission}
        preferences={push.preferences}
        supported={push.supported}
      />
      <ManagementLinks
        canManage={session.can("role.manage")}
        canViewDashboard={session.can("dashboard.view")}
      />
      <ResourceLinks />
      <Button
        className="w-full"
        onClick={() => void session.logout()}
        variant="outline"
      >
        <LogOut />{translate('ui.nav.signOut')}</Button>
    </div>
  );
}
