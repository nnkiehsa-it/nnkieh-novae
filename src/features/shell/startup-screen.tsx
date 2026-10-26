import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { useI18n, type MessageKey } from "@/i18n";
import type { StartupPhase } from "@/hooks/session-state";
import { timing } from "@/lib/motion-timing";
import { Button } from "@/ui/button";
import { BrandLockup } from "./brand";

const PHASE_LABELS = {
  session: "ui.app.startup.session",
  account: "ui.app.startup.account",
  profile: "ui.app.startup.profile",
  access: "ui.app.startup.access",
  ready: "ui.app.startup.ready",
} as const satisfies Record<StartupPhase, MessageKey>;

/**
 * One line saying what is under way. When the work moves on, the old words
 * lift away and the new ones settle in from below out of a slight blur, the
 * way a counter turns over, so progress reads as a change of words rather
 * than a list to scan.
 */
export function TurnOverLine({ label, step }: { label: string; step: string }) {
  return (
    <div className="relative grid h-6 place-items-center text-[0.9375rem] text-ink-muted" data-step={step}>
      <span className="sr-only" role="status">{label}</span>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
          aria-hidden
          exit={{ filter: "blur(2px)", opacity: 0, transition: timing("controlExit", "depart"), y: -8 }}
          initial={{ filter: "blur(2px)", opacity: 0, y: 8 }}
          key={step}
          transition={timing("reveal", "bounce")}
        >
          {label}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

/** The app icon and name centred on the screen, with what is happening beneath. */
export function LaunchFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <BrandLockup className="flex-col gap-4 [&>span:last-child]:text-2xl" markClassName="size-20 rounded-icon" />
      {children}
    </div>
  );
}

/** What fills the screen while the session is restored, or why it could not be. */
export function StartupScreen({ error, onRetry, onSignOut, steps }: {
  error?: string;
  onRetry?: () => Promise<void>;
  onSignOut?: () => Promise<void>;
  steps: readonly StartupPhase[];
}) {
  const { t } = useI18n();
  const [signingOut, setSigningOut] = React.useState(false);
  const signOut = async () => {
    if (!onSignOut) return;
    setSigningOut(true);
    try {
      await onSignOut();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : t("auth.serviceUnavailable"));
    } finally {
      setSigningOut(false);
    }
  };
  return (
    <div className="grid min-h-svh place-items-center px-[var(--gutter)]" data-startup-screen>
      <LaunchFrame>
        {error ? (
          <div className="grid max-w-sm gap-5">
            <p className="text-[0.9375rem] leading-relaxed text-ink-muted" role="alert">{t(error)}</p>
            <div className="flex justify-center gap-2">
              {onRetry ? <Button disabled={signingOut} onClick={() => void onRetry()}>{t("common.retry")}</Button> : null}
              {onSignOut ? (
                <Button onClick={() => void signOut()} status={signingOut ? "loading" : "idle"} variant="ghost">{t("auth.signOutLabel")}</Button>
              ) : null}
            </div>
          </div>
        ) : (
          <TurnOverLine label={t(PHASE_LABELS[steps.at(-1) ?? "session"])} step={steps.at(-1) ?? "session"} />
        )}
      </LaunchFrame>
    </div>
  );
}
