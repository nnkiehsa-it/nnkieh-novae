"use client";

import { ArrowClockwise, ArrowSquareOut, Copy, GithubLogo, ShieldCheck, SignOut, UserSwitch } from "@phosphor-icons/react/ssr";
import { toast } from "sonner";
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
    <div className="grid gap-6">
      <PageHeader title={t("ui.nav.settings")} />
      {/* Who is signed in sits beside the preferences on a wide screen and
          above them on a phone, with the account's own actions on its card. */}
      <div className="grid items-start gap-6 md:grid-cols-[17rem_minmax(0,1fr)] lg:grid-cols-[19rem_minmax(0,1fr)]">
        <Panel className="grid gap-4 md:sticky md:top-24">
          <div className="flex items-center gap-3.5">
            <Avatar className="size-12 text-lg" name={name} src={session.customPhotoUrl} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{name}</p>
              <p className="truncate text-[0.8125rem] text-ink-muted">{user.email}</p>
            </div>
          </div>
          <button
            className="flex min-w-0 items-center justify-between gap-3 rounded-tile bg-surface-raised px-3 py-2 text-ink-muted outline-none transition-[background-color] duration-[var(--motion-control)] ease-[var(--ease-move)] hover:bg-surface-pressed focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            onClick={() => void navigator.clipboard.writeText(user.uid).then(() => toast.success(t("ui.settings.uidCopied")))}
            type="button"
          >
            <span className="min-w-0 truncate font-mono text-xs">UID {user.uid}</span>
            <Copy aria-hidden className="size-4 shrink-0" />
          </button>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => void session.login({ selectAccount: true })} size="sm"><UserSwitch />{t("ui.settings.switchAccount")}</Button>
            <Button onClick={() => void session.logout()} size="sm" variant="danger"><SignOut />{t("ui.nav.signOut")}</Button>
          </div>
        </Panel>

        <div className="grid gap-6">
          <ListGroup title={t("ui.settings.appearance")}>
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
            {canAdminister ? <ListRow href="/admin" icon={<ShieldCheck />} label={t("admin.title")} /> : null}
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

          <ListGroup title={t("ui.settings.resources")}>
            <ListRow external href="https://tavricccc.github.io/novae-website/" icon={<ArrowSquareOut />} label={t("ui.settings.website")} />
            <ListRow external href="https://github.com/tavricccc/novae" icon={<GithubLogo />} label="GitHub" />
            <ListRow icon={<ArrowClockwise />} label={t("ui.settings.restart")} onClick={() => window.location.reload()} />
          </ListGroup>
        </div>
      </div>

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
