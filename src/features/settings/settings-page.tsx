import { ArrowClockwise, ArrowSquareOut, Copy, GithubLogo, ShieldCheck, SignOut, UserSwitch } from "@phosphor-icons/react/ssr";
import * as React from "react";
import { toast } from "sonner";
import { readThemePreference, setThemePreference, type ThemePreference } from "@/lib/theme";
import { Segmented } from "@/ui/segmented";
import { setLocale, useI18n, type AppLocale } from "@/i18n";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { useDraft } from "@/hooks/use-draft";
import { usePushNotifications, type PlatformAdminNotificationPreferences } from "@/hooks/use-push-notifications";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import { useSession } from "@/hooks/use-session";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { ListGroup, ListRow } from "@/ui/list";
import { PickerRow, SwitchRow } from "@/ui/list-controls";
import { PageHeader } from "@/ui/page";
import { Panel } from "@/ui/panel";
import { SaveBar } from "@/ui/save-bar";

const ADMIN_NOTIFICATIONS = [
  ["commentNotifications", "ui.settings.commentLabel"],
  ["issueNotifications", "ui.settings.issueLabel"],
  ["facilityNotifications", "ui.settings.facilityLabel"],
] as const;

export function SettingsPage() {
  const { locale, t } = useI18n();
  const session = useSession();
  const push = usePushNotifications();
  const pwa = usePwaInstall();
  const deviceFeedback = useActionFeedback();
  const adminPreferences = useDraft<PlatformAdminNotificationPreferences>({
    save: async (next) => push.saveAdminPreferences(next),
    source: push.adminPreferences,
  });
  const [theme, setTheme] = React.useState<ThemePreference>(readThemePreference);
  const user = session.user!;
  const name = user.displayName || t("ui.settings.unnamed");
  const canAdminister = session.can("role.manage") || session.can("category.manage") || session.can("dashboard.view");

  async function enablePush() {
    try {
      await deviceFeedback.run(async () => {
        if (!await push.enable()) throw new Error(t("ui.settings.pushUpdateFailed"));
      });
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : t("ui.settings.pushUpdateFailed"));
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-6">
      <PageHeader title={t("ui.nav.settings")} />
      <Panel className="flex flex-col items-center gap-4 p-7 text-center">
        <Avatar className="size-20 text-2xl" name={name} src={session.customPhotoUrl} />
        <div className="min-w-0">
          <p className="truncate text-xl font-semibold">{name}</p>
          <p className="truncate text-[0.9375rem] text-ink-muted">{user.email}</p>
        </div>
        <Button
          onClick={() => void navigator.clipboard.writeText(user.uid).then(() => toast.success(t("ui.settings.uidCopied")))}
          size="sm"
        >
          <Copy />
          UID
        </Button>
      </Panel>

      <ListGroup title={t("ui.settings.appearance")}>
        <li className="flex min-h-14 items-center justify-between gap-3 py-2 pl-4 pr-2">
          <span className="text-[0.9375rem]">{t("ui.settings.displayMode")}</span>
          <Segmented
            label={t("ui.settings.displayMode")}
            onChange={(next) => {
              setTheme(next);
              setThemePreference(next);
            }}
            options={[
              { label: t("ui.settings.system"), value: "system" },
              { label: t("ui.settings.light"), value: "light" },
              { label: t("ui.settings.dark"), value: "dark" },
            ]}
            value={theme}
          />
        </li>
        <PickerRow
          label={t("ui.settings.language")}
          onChange={(value: AppLocale) => setLocale(value)}
          options={[{ label: t("ui.settings.zhShort"), value: "zh-TW" }, { label: "English", value: "en" }]}
          value={locale}
        />
        <ListRow
          disabled={!pwa.canInstall || pwa.installed}
          label={t("ui.settings.installNovae")}
          onClick={() => void pwa.install().then((ok) => ok && toast.success(t("ui.settings.installStarted")))}
          value={pwa.installed ? t("ui.settings.installed") : pwa.canInstall ? undefined : t("ui.settings.installFromMenu")}
        />
      </ListGroup>

      {/* The browser only offers its permission prompt inside the click that
          asked for it, so this switch acts at once instead of joining a draft. */}
      {push.enabled ? null : (
        <ListGroup title={t("ui.settings.push")}>
          <SwitchRow
            checked={deviceFeedback.state !== "idle"}
            detail={push.permission === "denied" ? t("ui.settings.pushBlocked") : push.supported ? t("ui.settings.pushReady") : t("ui.settings.pushUnsupported")}
            disabled={push.loading || deviceFeedback.state !== "idle" || !push.supported || push.permission === "denied"}
            label={t("ui.settings.pushDevice")}
            onChange={(enabled) => { if (enabled) void enablePush(); }}
          />
        </ListGroup>
      )}

      {session.isAdmin && adminPreferences.value ? (
        <ListGroup title={t("ui.settings.platformAdminNotifications")}>
          {ADMIN_NOTIFICATIONS.map(([key, labelKey]) => (
            <SwitchRow
              checked={adminPreferences.value![key]}
              key={key}
              label={t(labelKey)}
              onChange={(enabled) => adminPreferences.update({ [key]: enabled })}
            />
          ))}
        </ListGroup>
      ) : null}

      {canAdminister ? (
        <ListGroup title={t("ui.settings.adminTools")}>
          <ListRow href="/admin" icon={<ShieldCheck />} label={t("admin.title")} />
        </ListGroup>
      ) : null}

      <ListGroup title={t("ui.settings.resources")}>
        <ListRow external href="https://tavricccc.github.io/novae-website/" icon={<ArrowSquareOut />} label={t("ui.settings.website")} />
        <ListRow external href="https://github.com/tavricccc/novae" icon={<GithubLogo />} label="GitHub" />
        <ListRow icon={<ArrowClockwise />} label={t("ui.settings.restart")} onClick={() => window.location.reload()} />
      </ListGroup>

      <ListGroup label={t("ui.nav.signOut")}>
        <ListRow icon={<UserSwitch />} label={t("ui.settings.switchAccount")} onClick={() => void session.login({ selectAccount: true })} />
        <ListRow icon={<SignOut />} label={t("ui.nav.signOut")} onClick={() => void session.logout()} tone="danger" />
      </ListGroup>

      <SaveBar
        changeCount={adminPreferences.changes.length}
        error={adminPreferences.error}
        onDiscard={adminPreferences.reset}
        onSave={() => void adminPreferences.submit()}
        status={adminPreferences.status}
      />
    </div>
  );
}
