import { AnimatePresence, motion } from "motion/react";
import { ArrowClockwise, Check } from "@phosphor-icons/react/ssr";
import { useI18n } from "@/i18n";
import { timing } from "@/lib/motion-timing";
import { useAppUpdate } from "@/hooks/use-app-update";
import { useTurnstile } from "@/features/security/turnstile";
import { BrandLockup } from "@/features/shell/brand";
import { Button } from "@/ui/button";
import { Dialog } from "@/ui/dialog";
import { Spinner } from "@/ui/feedback";

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
            aria-live="assertive"
            className="glass fixed inset-0 z-[100] grid place-items-center"
            exit={{ opacity: 0, transition: timing("controlExit", "depart") }}
            initial={{ opacity: 0 }}
            transition={timing("reveal")}
          >
            <div className="flex flex-col items-center gap-5 text-center">
              <BrandLockup className="flex-col gap-4 [&>span:last-child]:text-xl" markClassName="size-18 rounded-panel" />
              <p className="flex items-center gap-2.5 text-[0.9375rem] text-ink-muted">
                {update.phase === "reloaded" ? <Check className="size-4 text-positive" weight="bold" /> : <Spinner className="size-4" />}
                {t("ui.update.loading")}
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
