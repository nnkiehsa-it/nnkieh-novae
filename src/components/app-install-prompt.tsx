"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Copy, Download, Home, Share2, TriangleAlert } from "lucide-react";
import { AnimatePresence } from "motion/react";
import {
  useAppInstallPrompt,
  type AppInstallPromptMode,
} from "@/hooks/use-app-install-prompt";
import { resolveShareExit } from "@/hooks/share-entry-store";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { PromptStep } from "@/components/app-install/prompt-step";

type PromptView = "ask" | "home" | "guide" | "dismiss";

interface PromptStepContent {
  actions: ReactNode;
  description: string;
  icon: ReactNode;
  note?: string;
  steps: string[];
  title: string;
}

export function AppInstallPrompt() {
  const prompt = useAppInstallPrompt();
  const { t } = useI18n();
  const [view, setView] = useState<PromptView>("guide");
  const [direction, setDirection] = useState<1 | -1>(1);
  // The dialog has to survive its own closing animation, so the last thing it
  // was saying stays on screen until Radix has finished taking it away.
  const [shownMode, setShownMode] = useState<AppInstallPromptMode | null>(null);
  if (prompt.mode && prompt.mode !== shownMode) setShownMode(prompt.mode);
  const mode = prompt.mode ?? shownMode;
  const sharedExit = prompt.reason === "share-exit";

  // Asking a reader held inside an app's own browser whether they have Novae
  // installed leads nowhere: an installed app opens at its own start page, not
  // at the link they were sent. The only answer worth giving them is the one
  // that gets them to a browser, so they are given it directly.
  useEffect(() => {
    if (!prompt.mode) return;
    setDirection(1);
    setView(prompt.reason === "share-exit" ? "ask" : "guide");
  }, [prompt.mode, prompt.reason]);

  if (!mode) return null;

  const go = (next: PromptView, nextDirection: 1 | -1 = 1) => {
    setDirection(nextDirection);
    setView(next);
  };

  const finish = (proceed: boolean) => {
    if (sharedExit) resolveShareExit(proceed);
    prompt.dismiss();
  };

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
    steps = [t("auth.pwaStepOpenMenu"), t("auth.pwaStepOpenBrowser")];
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
    icon = <Share2 className="size-5" aria-hidden />;
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

  const installsNatively = mode === "native-install" && prompt.canInstallNatively;

  const handlePrimaryAction = async () => {
    if (installsNatively) {
      await prompt.promptInstall();
      return;
    }
    await prompt.copyInstallUrl();
  };

  const hasPrimaryAction = installsNatively
    || mode === "in-app-browser"
    || mode === "ios-open-safari";

  let step: PromptStepContent = {
    actions: (
      <>
        {/* An app's own browser cannot sign in at all, so there is nothing to
            put off until later: the only way on from here is a real browser,
            and the automatic handoff is not guaranteed to have worked. */}
        {mode === "in-app-browser" ? null : sharedExit ? (
          <Button variant="outline" onClick={() => finish(true)} disabled={prompt.isPrompting}>
            {t("auth.pwaShareExitContinue")}
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={() => go("dismiss")}
            disabled={prompt.isPrompting}
          >
            {t("auth.pwaLater")}
          </Button>
        )}
        {hasPrimaryAction ? (
          <Button onClick={() => void handlePrimaryAction()} disabled={prompt.isPrompting}>
            {installsNatively ? <Download className="size-4" /> : <Copy className="size-4" />}
            {installsNatively ? t("auth.pwaInstall") : t("auth.pwaCopyUrl")}
          </Button>
        ) : null}
      </>
    ),
    description: `${description}${notificationsNote ? ` ${notificationsNote}` : ""}`,
    icon,
    note: mode === "in-app-browser" ? undefined : t("auth.pwaAlreadyInstalledNote"),
    steps,
    title,
  };

  if (view === "ask") {
    step = {
      actions: (
        <>
          <Button variant="ghost" onClick={() => finish(true)}>
            {t("auth.pwaShareExitContinue")}
          </Button>
          <Button variant="outline" onClick={() => go("guide")}>
            {t("auth.pwaShareExitNotInstalled")}
          </Button>
          <Button onClick={() => go("home")}>
            {t("auth.pwaShareExitInstalled")}
          </Button>
        </>
      ),
      description: t("auth.pwaShareExitDescription"),
      icon: <Home className="size-5" aria-hidden />,
      steps: [],
      title: t("auth.pwaShareExitTitle"),
    };
  } else if (view === "home") {
    step = {
      actions: (
        <>
          <Button
            variant="outline"
            onClick={() => void prompt.copyInstallUrl()}
            disabled={prompt.isPrompting}
          >
            <Copy className="size-4" />
            {t("auth.pwaCopyUrl")}
          </Button>
          <Button onClick={() => finish(false)} disabled={prompt.isPrompting}>
            {t("auth.pwaDone")}
          </Button>
        </>
      ),
      description: t("auth.pwaOpenFromHomeDescription"),
      icon: <Home className="size-5" aria-hidden />,
      steps: [t("auth.pwaStepLeaveBrowser"), t("auth.pwaStepOpenFromHome")],
      title: t("auth.pwaOpenFromHomeTitle"),
    };
  } else if (view === "dismiss") {
    step = {
      actions: (
        <>
          <Button variant="ghost" onClick={() => finish(false)} disabled={prompt.isPrompting}>
            {t("auth.pwaDismissConfirm")}
          </Button>
          <Button onClick={() => go("guide", -1)} disabled={prompt.isPrompting}>
            <Download className="size-4" />
            {t("auth.pwaDismissGoBack")}
          </Button>
        </>
      ),
      description: t("auth.pwaDismissConfirmDescription"),
      icon: <TriangleAlert className="size-5" aria-hidden />,
      steps: [],
      title: t("auth.pwaDismissConfirmTitle"),
    };
  }

  return (
    <Dialog open={prompt.open}>
      <DialogContent showCloseButton={false}>
        <AnimatePresence custom={direction} initial={false} mode="wait">
          <PromptStep
            actions={step.actions}
            description={step.description}
            direction={direction}
            icon={step.icon}
            key={view === "guide" ? mode : view}
            note={step.note}
            steps={step.steps}
            title={step.title}
          />
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
