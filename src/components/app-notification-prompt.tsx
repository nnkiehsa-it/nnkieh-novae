"use client";

import { Bell } from "lucide-react";
import { toast } from "sonner";
import { useAppNotificationPrompt } from "@/hooks/use-app-notification-prompt";
import { useSession } from "@/hooks/use-session";
import { useI18n } from "@/i18n";
import { ActionFeedbackIcon } from "@/components/ui/action-feedback-icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function AppNotificationPrompt() {
  const session = useSession();
  const prompt = useAppNotificationPrompt(session.user?.uid);
  const { t } = useI18n();

  const handleEnable = async () => {
    const result = await prompt.enable();
    if (result === "enabled") {
      toast.success(t("notification.pushNotificationIsEnabledForThisDevice"));
    } else if (result === "failed") {
      toast.error(t("notification.pushSetupFailed"));
    }
  };

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open && !prompt.isPrompting) prompt.dismiss();
      }}
      open={prompt.open}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <div className="mb-1 flex size-10 items-center justify-center rounded-xl bg-accent text-foreground">
            <Bell className="size-5" aria-hidden />
          </div>
          <DialogTitle>{t("notification.promptTitle")}</DialogTitle>
          <DialogDescription>
            {t("notification.promptDescription")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            disabled={prompt.isPrompting}
            onClick={prompt.dismiss}
            variant="outline"
          >
            {t("notification.promptLater")}
          </Button>
          <Button
            disabled={prompt.isPrompting}
            onClick={() => void handleEnable()}
          >
            {prompt.isPrompting ? (
              <ActionFeedbackIcon
                className="bg-transparent [&>svg]:size-5"
                size="md"
                state="loading"
              />
            ) : (
              <Bell className="size-4" />
            )}
            {t("notification.promptEnable")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
