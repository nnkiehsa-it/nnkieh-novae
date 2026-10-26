import { AnimatePresence, motion } from "motion/react";
import { ArrowClockwise } from "@phosphor-icons/react/ssr";
import { useI18n } from "@/i18n";
import { timing } from "@/lib/motion-timing";
import { useAppUpdate } from "@/hooks/use-app-update";
import { useTurnstile } from "@/features/security/turnstile";
import { LaunchFrame, TurnOverLine } from "@/features/shell/startup-screen";
import { Button } from "@/ui/button";
import { Dialog } from "@/ui/dialog";

/** Moves the app onto a newer deployment, asking first when it has to. */
export function UpdateGate() {
  const { t } = useI18n();
  // A security check lives in an iframe that holds its own state; reloading
  // while one is on screen would throw it away, so a new version waits.
  const { verifying } = useTurnstile();
  const update = useAppUpdate(verifying);
  const busy = update.phase === "reloading" || update.phase === "reloaded";

  return (
    <>
      <Dialog
        actions={<Button onClick={update.reload}><ArrowClockwise weight="bold" />{t("ui.update.action")}</Button>}
        description={t("ui.update.description")}
        dismissible={false}
        icon={<ArrowClockwise weight="bold" />}
        open={update.promptOpen}
        title={t("ui.update.title")}
      />
      <AnimatePresence>
        {busy ? (
          <motion.div
            animate={{ opacity: 1 }}
            className="launch-canvas fixed inset-0 z-[100] grid place-items-center px-[var(--gutter)]"
            exit={{ opacity: 0, transition: timing("controlExit", "depart") }}
            initial={{ opacity: 0 }}
            transition={timing("reveal")}
          >
            <LaunchFrame>
              <TurnOverLine label={t(update.phase === "reloaded" ? "ui.update.reopening" : "ui.update.loading")} step={update.phase} />
            </LaunchFrame>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
