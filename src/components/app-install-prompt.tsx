"use client";

import { useState } from "react";
import { Copy, Download, ExternalLink, Share2, TriangleAlert } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useAppInstallPrompt } from "@/hooks/use-app-install-prompt";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function AppInstallPrompt() {
  const prompt = useAppInstallPrompt();
  const { t } = useI18n();
  const mode = prompt.mode;
  const [confirmingDismiss, setConfirmingDismiss] = useState(false);

  if (!mode) return null;

  const browserLabel = prompt.browserName
    ?? (prompt.iosBrowserGuide === "Google" ? "Google App" : "Chrome");
  const notificationsNote = prompt.reason === "notifications"
    ? t("auth.pwaNotificationsNote")
    : "";

  let title = "";
  let description = "";
  let steps: string[] = [];
  let icon = <Download className="size-5" aria-hidden />;

  if (mode === "in-app-browser") {
    title = t("auth.pwaInAppTitle");
    description = t("auth.pwaInAppDescription", { browser: browserLabel });
    steps = [
      t("auth.pwaStepOpenMenu"),
      t("auth.pwaStepOpenBrowser"),
      t("auth.pwaStepInstall"),
    ];
    icon = <TriangleAlert className="size-5" aria-hidden />;
  } else if (mode === "ios-open-safari") {
    title = t("auth.pwaOpenSafariTitle");
    description = t("auth.pwaOpenSafariDescription", { browser: browserLabel });
    steps = [
      t("auth.pwaStepCopyUrl"),
      t("auth.pwaStepOpenSafari"),
      t("auth.pwaStepShare"),
      t("auth.pwaStepAddHome"),
    ];
    icon = <ExternalLink className="size-5" aria-hidden />;
  } else if (mode === "ios-install") {
    title = t("auth.pwaIosInstallTitle");
    description = t("auth.pwaIosInstallDescription");
    steps = [
      t("auth.pwaStepShare"),
      t("auth.pwaStepAddHome"),
      t("auth.pwaStepOpenFromHome"),
    ];
    icon = <Share2 className="size-5" aria-hidden />;
  } else {
    title = t("auth.pwaAndroidInstallTitle");
    description = t("auth.pwaAndroidInstallDescription");
    steps = prompt.canInstallNatively
      ? [t("auth.pwaStepTapInstall"), t("auth.pwaStepOpenFromHome")]
      : [t("auth.pwaStepOpenMenu"), t("auth.pwaStepInstall"), t("auth.pwaStepOpenFromHome")];
  }

  const handlePrimaryAction = async () => {
    if (mode === "native-install" && prompt.canInstallNatively) {
      await prompt.promptInstall();
      return;
    }
    if (mode === "in-app-browser" && prompt.isAndroid) {
      if (prompt.openExternalBrowser()) return;
    }
    if (mode === "in-app-browser" || mode === "ios-open-safari") {
      await prompt.copyInstallUrl();
    }
  };

  const hasPrimaryAction =
    (mode === "native-install" && prompt.canInstallNatively)
    || mode === "in-app-browser"
    || mode === "ios-open-safari";

  const primaryLabel = mode === "native-install"
    ? t("auth.pwaInstall")
    : mode === "in-app-browser" && prompt.isAndroid
      ? t("auth.pwaOpenBrowser")
      : t("auth.pwaCopyUrl");

  const handleDismiss = () => {
    setConfirmingDismiss(false);
    prompt.dismiss();
  };

  const dialogTitle = confirmingDismiss ? t("auth.pwaDismissConfirmTitle") : title;
  const dialogDescription = confirmingDismiss
    ? t("auth.pwaDismissConfirmDescription")
    : `${description}${notificationsNote ? ` ${notificationsNote}` : ""}`;
  const dialogIcon = confirmingDismiss
    ? <TriangleAlert className="size-5" aria-hidden />
    : icon;

  return (
    <Dialog open={prompt.open}>
      <DialogContent showCloseButton={false}>
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            animate={{ opacity: 1, scale: 1, x: 0 }}
            className="grid gap-5"
            exit={{ opacity: 0, scale: 0.98, x: confirmingDismiss ? 12 : -12 }}
            initial={{ opacity: 0, scale: 0.98, x: confirmingDismiss ? -12 : 12 }}
            key={confirmingDismiss ? "confirm-dismiss" : mode}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          >
            <DialogHeader>
              <div className="mb-1 flex size-10 items-center justify-center rounded-xl bg-accent text-foreground">
                {dialogIcon}
              </div>
              <DialogTitle>{dialogTitle}</DialogTitle>
              <DialogDescription>{dialogDescription}</DialogDescription>
            </DialogHeader>

            {!confirmingDismiss ? (
              <ol className="space-y-3">
                {steps.map((step, index) => (
                  <li className="flex gap-3 text-sm leading-6" key={step}>
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            ) : null}

            <DialogFooter>
              {confirmingDismiss ? (
                <>
                  <Button variant="ghost" onClick={handleDismiss} disabled={prompt.isPrompting}>
                    {t("auth.pwaDismissConfirm")}
                  </Button>
                  <Button onClick={() => setConfirmingDismiss(false)} disabled={prompt.isPrompting}>
                    <Download className="size-4" />
                    {t("auth.pwaDismissGoBack")}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setConfirmingDismiss(true)}
                    disabled={prompt.isPrompting}
                  >
                    {t("auth.pwaLater")}
                  </Button>
                  {mode === "in-app-browser" && prompt.isAndroid ? (
                    <Button
                      variant="outline"
                      onClick={() => void prompt.copyInstallUrl()}
                      disabled={prompt.isPrompting}
                    >
                      <Copy className="size-4" />
                      {t("auth.pwaCopyUrl")}
                    </Button>
                  ) : null}
                  {hasPrimaryAction ? (
                    <Button onClick={() => void handlePrimaryAction()} disabled={prompt.isPrompting}>
                      {mode === "native-install" ? <Download className="size-4" /> : <ExternalLink className="size-4" />}
                      {primaryLabel}
                    </Button>
                  ) : null}
                </>
              )}
            </DialogFooter>
          </motion.div>
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
