"use client";
import { t as translate } from "@/i18n";

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
  type NotificationOption,
} from "@/components/settings/notification-card";
import {
  ManagementLinks,
  ResourceLinks,
} from "@/components/settings/settings-links";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-state";
import { SaveBar } from "@/components/ui/save-bar";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { useDraft } from "@/hooks/use-draft";

export default function SettingsPage() {
  const session = useSession();
  const push = usePushNotifications();
  const pwa = usePwaInstall();
  const { locale } = useI18n();
  const { resolvedTheme, setTheme, theme } = useTheme();
  const notificationFeedback = useActionFeedback();
  const preferences = useDraft({
    save: async (next) => push.savePreferences(next),
    source: push.preferences,
  });
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
    }
  }

  return (
    <div className="w-full space-y-5">
      <PageHeader title={translate("ui.nav.settings")} />
      <div className="space-y-5">
        <SettingsAccountCard
          customPhotoUrl={session.customPhotoUrl}
          onCopyUid={() =>
            void navigator.clipboard
              .writeText(user.uid)
              .then(() => toast.success(translate("ui.settings.uidCopied")))
          }
          onSwitchAccount={() => void session.login({ selectAccount: true })}
          user={user}
        />
        <AppearanceInstallCards
          canInstall={pwa.canInstall}
          installed={pwa.installed}
          locale={locale}
          onInstall={() =>
            void pwa.install().then(
              (ok) => ok && toast.success(translate("ui.settings.installStarted")),
            )
          }
          onLocaleChange={setLocale}
          onThemeChange={setTheme}
          resolvedTheme={resolvedTheme}
          theme={theme}
        />
        <NotificationCard
          deviceFeedbackState={notificationFeedback.state}
          enabled={push.enabled}
          loading={push.loading}
          onEnabledChange={(enabled) => void togglePush(enabled)}
          onPreferenceChange={(key, enabled) =>
            preferences.update({ [key]: enabled } as Partial<typeof push.preferences>)
          }
          options={notificationOptions}
          permission={push.permission}
          preferences={preferences.value ?? push.preferences}
          supported={push.supported}
        />
        <ManagementLinks
          canManage={
            session.can("role.manage")
            || session.can("category.manage")
            || session.can("dashboard.view")
          }
        />
        <ResourceLinks />
        <Button
          className="w-full"
          onClick={() => void session.logout()}
          variant="outline"
        >
          <LogOut />
          {translate("ui.nav.signOut")}
        </Button>
        <SaveBar
          changeCount={preferences.changes.length}
          onDiscard={preferences.reset}
          onSave={() => void preferences.submit()}
          status={preferences.status}
        />
      </div>
    </div>
  );
}
