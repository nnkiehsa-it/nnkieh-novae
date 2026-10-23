import { Bell } from "@phosphor-icons/react/ssr";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { useAppNotificationPrompt } from "@/hooks/use-app-notification-prompt";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/ui/button";
import { Dialog } from "@/ui/dialog";

/** Asks once, at a good moment, whether this device should receive pushes. */
export function NotificationPrompt() {
  const session = useSession();
  const prompt = useAppNotificationPrompt(session.user?.uid);
  const { t } = useI18n();

  const enable = async () => {
    const result = await prompt.enable();
    if (result === "enabled") toast.success(t("notification.pushNotificationIsEnabledForThisDevice"));
    else if (result === "failed") toast.error(t("notification.pushSetupFailed"));
  };

  return (
    <Dialog
      actions={
        <>
          <Button disabled={prompt.isPrompting} onClick={prompt.dismiss} variant="ghost">{t("notification.promptLater")}</Button>
          <Button onClick={() => void enable()} status={prompt.isPrompting ? "loading" : "idle"}>{t("notification.promptEnable")}</Button>
        </>
      }
      description={t("notification.promptDescription")}
      icon={<Bell weight="fill" />}
      onOpenChange={(open) => {
        if (!open && !prompt.isPrompting) prompt.dismiss();
      }}
      open={prompt.open}
      title={t("notification.promptTitle")}
    />
  );
}
