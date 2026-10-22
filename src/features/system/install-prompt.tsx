import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Copy, DownloadSimple, HouseLine, ShareFat, WarningCircle } from "@phosphor-icons/react/ssr";
import { useI18n } from "@/i18n";
import { timing } from "@/lib/motion-timing";
import { resolveShareExit } from "@/hooks/share-entry-store";
import { useAppInstallPrompt, type AppInstallPromptMode } from "@/hooks/use-app-install-prompt";
import { Button } from "@/ui/button";
import { Dialog } from "@/ui/dialog";

type View = "ask" | "home" | "guide" | "dismiss";
type Translate = ReturnType<typeof useI18n>["t"];

interface StepAction {
  icon?: React.ReactNode;
  key: string;
  label: string;
  onClick: () => void;
  variant: "primary" | "secondary" | "ghost";
}

interface Step {
  actions: StepAction[];
  description: string;
  icon: React.ReactNode;
  note?: string;
  steps: string[];
  title: string;
}

interface StepContext {
  browser: string;
  canInstallNatively: boolean;
  copy: () => void;
  finish: (proceed: boolean) => void;
  go: (view: View, direction?: 1 | -1) => void;
  install: () => void;
  mode: AppInstallPromptMode;
  notifications: boolean;
  sharedExit: boolean;
  t: Translate;
}

/** How to get Novae onto this device, for the browser and platform it is in. */
function guideStep({ browser, canInstallNatively, copy, finish, go, install, mode, notifications, sharedExit, t }: StepContext): Step {
  const native = mode === "native-install" && canInstallNatively;
  const guides: Record<AppInstallPromptMode, Pick<Step, "description" | "icon" | "steps" | "title">> = {
    "in-app-browser": {
      description: t("auth.pwaInAppDescription", { browser }),
      icon: <WarningCircle weight="fill" />,
      steps: [t("auth.pwaStepOpenMenu"), t("auth.pwaStepOpenBrowser")],
      title: t("auth.pwaInAppTitle"),
    },
    "ios-open-safari": {
      description: t("auth.pwaOpenSafariDescription", { browser }),
      icon: <ShareFat weight="fill" />,
      steps: [t("auth.pwaStepCopyUrl"), t("auth.pwaStepOpenSafari"), t("auth.pwaStepShare"), t("auth.pwaStepAddHome")],
      title: t("auth.pwaOpenSafariTitle"),
    },
    "ios-install": {
      description: t("auth.pwaIosInstallDescription"),
      icon: <ShareFat weight="fill" />,
      steps: [t("auth.pwaStepShare"), t("auth.pwaStepAddHome"), t("auth.pwaStepOpenFromHome")],
      title: t("auth.pwaIosInstallTitle"),
    },
    "native-install": {
      description: t("auth.pwaAndroidInstallDescription"),
      icon: <DownloadSimple weight="bold" />,
      steps: canInstallNatively
        ? [t("auth.pwaStepTapInstall"), t("auth.pwaStepOpenFromHome")]
        : [t("auth.pwaStepOpenMenu"), t("auth.pwaStepInstall"), t("auth.pwaStepOpenFromHome")],
      title: t("auth.pwaAndroidInstallTitle"),
    },
  };
  const guide = guides[mode];
  const actions: StepAction[] = [];
  // An app's own browser cannot sign in at all, so there is nothing to put off
  // until later: the only way on is a real browser.
  if (mode !== "in-app-browser") {
    actions.push(sharedExit
      ? { key: "continue", label: t("auth.pwaShareExitContinue"), onClick: () => finish(true), variant: "ghost" }
      : { key: "later", label: t("auth.pwaLater"), onClick: () => go("dismiss"), variant: "ghost" });
  }
  if (native) actions.push({ icon: <DownloadSimple weight="bold" />, key: "install", label: t("auth.pwaInstall"), onClick: install, variant: "primary" });
  else if (mode === "in-app-browser" || mode === "ios-open-safari") {
    actions.push({ icon: <Copy weight="bold" />, key: "copy", label: t("auth.pwaCopyUrl"), onClick: copy, variant: "primary" });
  }
  return {
    ...guide,
    actions,
    description: notifications ? `${guide.description} ${t("auth.pwaNotificationsNote")}` : guide.description,
    note: mode === "in-app-browser" ? undefined : t("auth.pwaAlreadyInstalledNote"),
  };
}

function stepFor(view: View, context: StepContext): Step {
  const { copy, finish, go, t } = context;
  if (view === "ask") {
    return {
      actions: [
        { key: "continue", label: t("auth.pwaShareExitContinue"), onClick: () => finish(true), variant: "ghost" },
        { key: "missing", label: t("auth.pwaShareExitNotInstalled"), onClick: () => go("guide"), variant: "secondary" },
        { key: "installed", label: t("auth.pwaShareExitInstalled"), onClick: () => go("home"), variant: "primary" },
      ],
      description: t("auth.pwaShareExitDescription"),
      icon: <HouseLine weight="fill" />,
      steps: [],
      title: t("auth.pwaShareExitTitle"),
    };
  }
  if (view === "home") {
    return {
      actions: [
        { icon: <Copy weight="bold" />, key: "copy", label: t("auth.pwaCopyUrl"), onClick: copy, variant: "secondary" },
        { key: "done", label: t("auth.pwaDone"), onClick: () => finish(false), variant: "primary" },
      ],
      description: t("auth.pwaOpenFromHomeDescription"),
      icon: <HouseLine weight="fill" />,
      steps: [t("auth.pwaStepLeaveBrowser"), t("auth.pwaStepOpenFromHome")],
      title: t("auth.pwaOpenFromHomeTitle"),
    };
  }
  if (view === "dismiss") {
    return {
      actions: [
        { key: "confirm", label: t("auth.pwaDismissConfirm"), onClick: () => finish(false), variant: "ghost" },
        { icon: <DownloadSimple weight="bold" />, key: "back", label: t("auth.pwaDismissGoBack"), onClick: () => go("guide", -1), variant: "primary" },
      ],
      description: t("auth.pwaDismissConfirmDescription"),
      icon: <WarningCircle weight="fill" />,
      steps: [],
      title: t("auth.pwaDismissConfirmTitle"),
    };
  }
  return guideStep(context);
}

const variants = {
  center: { opacity: 1, x: 0 },
  enter: (direction: 1 | -1) => ({ opacity: 0, x: 16 * direction }),
  exit: (direction: 1 | -1) => ({ opacity: 0, x: -16 * direction }),
};

/** Walks a visitor from a browser tab to the installed app. */
export function InstallPrompt() {
  const prompt = useAppInstallPrompt();
  const { t } = useI18n();
  const [view, setView] = React.useState<View>("guide");
  const [direction, setDirection] = React.useState<1 | -1>(1);
  // The dialog keeps saying what it last said while it animates away.
  const [shownMode, setShownMode] = React.useState<AppInstallPromptMode | null>(null);
  if (prompt.mode && prompt.mode !== shownMode) setShownMode(prompt.mode);
  const mode = prompt.mode ?? shownMode;
  const sharedExit = prompt.reason === "share-exit";

  // A reader held inside an app's own browser after following a shared link is
  // asked first whether they already have Novae, since the installed app opens
  // at its own start page rather than at that link.
  React.useEffect(() => {
    if (!prompt.mode) return;
    setDirection(1);
    setView(prompt.reason === "share-exit" ? "ask" : "guide");
  }, [prompt.mode, prompt.reason]);

  if (!mode) return null;

  const step = stepFor(view, {
    browser: prompt.browserName ?? (prompt.iosBrowserGuide === "Google" ? "Google App" : "Chrome"),
    canInstallNatively: prompt.canInstallNatively,
    copy: () => void prompt.copyInstallUrl(),
    finish: (proceed) => {
      if (sharedExit) resolveShareExit(proceed);
      prompt.dismiss();
    },
    go: (next, nextDirection = 1) => {
      setDirection(nextDirection);
      setView(next);
    },
    install: () => void prompt.promptInstall(),
    mode,
    notifications: prompt.reason === "notifications",
    sharedExit,
    t,
  });

  return (
    <Dialog dismissible={false} open={prompt.open} title={step.title}>
      <AnimatePresence custom={direction} initial={false} mode="wait">
        <motion.div
          animate="center"
          className="-mt-2 grid gap-5"
          custom={direction}
          exit="exit"
          initial="enter"
          key={view === "guide" ? mode : view}
          transition={timing("control")}
          variants={variants}
        >
          <div className="flex gap-4">
            <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-raised [&_svg]:size-5">{step.icon}</span>
            <p className="text-[0.9375rem] leading-relaxed text-ink-muted">{step.description}</p>
          </div>
          {step.steps.length ? (
            <ol className="grid gap-3">
              {step.steps.map((line, index) => (
                <li className="flex items-start gap-3 text-[0.9375rem] leading-relaxed" key={line}>
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-contrast text-xs font-semibold text-on-contrast">{index + 1}</span>
                  <span className="pt-0.5">{line}</span>
                </li>
              ))}
            </ol>
          ) : null}
          {step.note ? <p className="rounded-tile bg-surface-raised px-4 py-3 text-sm leading-relaxed text-ink-muted">{step.note}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            {step.actions.map((action) => (
              <Button disabled={prompt.isPrompting} key={action.key} onClick={action.onClick} variant={action.variant}>
                {action.icon}
                {action.label}
              </Button>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </Dialog>
  );
}
