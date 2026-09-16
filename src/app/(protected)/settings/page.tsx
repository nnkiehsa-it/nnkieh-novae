"use client";
import { t as translate } from "@/i18n";

import { LogOut, UserRoundCog } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { useSession } from "@/hooks/use-session";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import { setLocale, useI18n } from "@/i18n";
import { SettingsAccountSection } from "@/components/settings/account-section";
import { AppearanceSection } from "@/components/settings/appearance-section";
import {
  NotificationCard,
  type NotificationOption,
} from "@/components/settings/notification-card";
import {
  ManagementLinks,
  ResourceLinks,
} from "@/components/settings/settings-links";
import { ListActionRow, ListSection } from "@/components/ui/list";
import { PageHeader } from "@/components/ui/page-state";
import { SaveBar } from "@/components/ui/save-bar";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { useDraft } from "@/hooks/use-draft";

export default function SettingsPage() {
  const session = useSession();
  const push = usePushNotifications();
  const pwa = usePwaInstall();
  const { locale } = useI18n();
  const { setTheme, theme } = useTheme();
  const notificationFeedback = useActionFeedback();
  const preferences = useDraft({
    save: async (next) => push.savePreferences(next),
    source: push.preferences,
  });
  const user = session.user!;
  const notificationOptions: NotificationOption[] = [
    { key: "comments", label: translate("ui.settings.commentLabel") },
    { key: "issueUpdates", label: translate("ui.settings.issueLabel") },
    { key: "facilityUpdates", label: translate("ui.settings.facilityLabel") },
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
        <SettingsAccountSection
          customPhotoUrl={session.customPhotoUrl}
          onCopyUid={() =>
            void navigator.clipboard
              .writeText(user.uid)
              .then(() => toast.success(translate("ui.settings.uidCopied")))
          }
          user={user}
        />
        <AppearanceSection
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
        <ListSection>
          <ListActionRow
            icon={UserRoundCog}
            label={translate("ui.settings.switchAccount")}
            onClick={() => void session.login({ selectAccount: true })}
          />
          <ListActionRow
            icon={LogOut}
            label={translate("ui.nav.signOut")}
            onClick={() => void session.logout()}
            tone="destructive"
          />
        </ListSection>
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
