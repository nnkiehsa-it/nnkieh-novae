import * as React from "react";
import { Check } from "@phosphor-icons/react/ssr";
import { toast } from "sonner";
import { useI18n, type MessageKey } from "@/i18n";
import type { StartupPhase } from "@/hooks/session-state";
import { cn } from "@/lib/utils";
import { Button } from "@/ui/button";
import { Spinner } from "@/ui/feedback";
import { BrandLockup } from "./brand";

const PHASE_LABELS = {
  session: "ui.app.startup.session",
  account: "ui.app.startup.account",
  profile: "ui.app.startup.profile",
  access: "ui.app.startup.access",
  ready: "ui.app.startup.ready",
} as const satisfies Record<StartupPhase, MessageKey>;

/**
 * The steps startup has actually taken, in order: each finished one is ticked
 * and the one under way spins, so a slow step reads as that step, not as a
 * loop of words. The list holds room for every step it may grow to, so the
 * screen does not shift as it grows.
 */
function StartupSteps({ steps }: { steps: readonly StartupPhase[] }) {
  const { t } = useI18n();
  const current = steps.at(-1) ?? "session";
  return (
    <div className="min-h-[7.5rem]" data-startup-phase={current}>
      <span className="sr-only" role="status">{t(PHASE_LABELS[current])}</span>
      <ol aria-hidden className="grid gap-2 text-left text-[0.9375rem]">
        {steps.map((step) => {
          const done = step !== current || step === "ready";
          return (
            <li className={cn("message-in flex h-6 items-center gap-2.5", done ? "text-ink-faint" : "text-ink-muted")} key={step}>
              {done ? <Check className="size-4" weight="bold" /> : <Spinner className="size-4" />}
              {t(PHASE_LABELS[step])}
            </li>
          );
        })}
      </ol>
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
          <StartupSteps steps={steps} />
        )}
      </div>
    </div>
  );
}
