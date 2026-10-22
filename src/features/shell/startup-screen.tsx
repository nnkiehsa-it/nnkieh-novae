import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { useI18n, type MessageKey } from "@/i18n";
import { timing } from "@/lib/motion-timing";
import type { StartupPhase } from "@/hooks/session-state";
import { Button } from "@/ui/button";
import { Spinner } from "@/ui/feedback";
import { BrandLockup } from "./brand";

// Each phase names what is happening, then what it is waiting on, so a slow
// step reads as progress rather than as a frozen screen.
const PHASE_LABELS = {
  session: ["ui.app.startup.session", "ui.app.startup.sessionWaiting"],
  security: ["ui.app.startup.security", "ui.app.startup.securityWaiting"],
  account: ["ui.app.startup.account", "ui.app.startup.accountWaiting"],
  profile: ["ui.app.startup.profile", "ui.app.startup.profileWaiting"],
  access: ["ui.app.startup.access", "ui.app.startup.accessWaiting"],
  content: ["ui.app.startup.content", "ui.app.startup.contentWaiting"],
  ready: ["ui.app.startup.ready"],
} as const satisfies Record<StartupPhase, readonly MessageKey[]>;

function PhaseLabel({ phase }: { phase: StartupPhase }) {
  const { t } = useI18n();
  const labels = PHASE_LABELS[phase];
  const [index, setIndex] = React.useState(0);
  React.useEffect(() => {
    if (labels.length < 2) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % labels.length), 1_800);
    return () => window.clearInterval(timer);
  }, [labels]);
  return (
    <div className="flex h-6 items-center gap-2.5 text-[0.9375rem] text-ink-muted" data-startup-phase={phase}>
      <span className="sr-only" role="status">{t(labels[0])}</span>
      <Spinner className="size-4" />
      <AnimatePresence initial={false} mode="wait">
        <motion.span
          animate={{ opacity: 1 }}
          aria-hidden
          exit={{ opacity: 0, transition: timing("controlExit", "depart") }}
          initial={{ opacity: 0 }}
          key={index}
          transition={timing("control")}
        >
          {t(labels[index])}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

/** What fills the screen while the session is restored, or why it could not be. */
export function StartupScreen({ error, onRetry, onSignOut, phase = "session" }: {
  error?: string;
  onRetry?: () => Promise<void>;
  onSignOut?: () => Promise<void>;
  phase?: StartupPhase;
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
      <div className="flex flex-col items-center gap-6 text-center">
        <BrandLockup className="flex-col gap-4 [&>span:last-child]:text-2xl" markClassName="size-20 rounded-panel" />
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
          <PhaseLabel key={phase} phase={phase} />
        )}
      </div>
    </div>
  );
}
