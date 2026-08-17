"use client";

import { Copy, Download, ExternalLink, Share2, TriangleAlert } from "lucide-react";
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

  return (
    <Dialog
      open={prompt.open}
      onOpenChange={(open) => {
        if (!open) prompt.dismiss();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <div className="mb-1 flex size-10 items-center justify-center rounded-xl bg-accent text-foreground">
            {icon}
          </div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description}{notificationsNote ? ` ${notificationsNote}` : ""}
          </DialogDescription>
        </DialogHeader>

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

        <DialogFooter>
          <Button variant="outline" onClick={prompt.dismiss} disabled={prompt.isPrompting}>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
