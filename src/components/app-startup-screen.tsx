"use client";

import * as React from "react";
import { toast } from "sonner";
import { t as translate, useI18n as useLocaleSubscription, type MessageKey } from "@/i18n";
import { BrandLockup } from "@/components/ui/brand";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import type { StartupPhase } from "@/hooks/session-state";

const STARTUP_LABELS = {
  session: ["ui.app.startup.session", "ui.app.startup.sessionWaiting"],
  security: ["ui.app.startup.security", "ui.app.startup.securityWaiting"],
  account: ["ui.app.startup.account", "ui.app.startup.accountWaiting"],
  profile: ["ui.app.startup.profile", "ui.app.startup.profileWaiting"],
  access: ["ui.app.startup.access", "ui.app.startup.accessWaiting"],
  content: ["ui.app.startup.content", "ui.app.startup.contentWaiting"],
  ready: ["ui.app.startup.ready"],
} as const satisfies Record<StartupPhase, readonly MessageKey[]>;

function StartupStatus({ phase }: { phase: StartupPhase }) {
  const labels = STARTUP_LABELS[phase];
  const [index, setIndex] = React.useState(0);
  React.useEffect(() => {
    if (labels.length < 2) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % labels.length), 1_800);
    return () => window.clearInterval(timer);
  }, [labels]);
  const label = translate(labels[index]);
  return (
      <div className="t-startup-status mt-0.5 min-h-6" data-phase={phase}>
        <span className="sr-only" role="status">{translate(labels[0])}</span>
        <p aria-hidden="true" className="t-shimmer text-base text-muted-foreground" data-text={label} key={index}>{label}</p>
      </div>
  );
}

export function AppStartupScreen({ phase = "session", error, onRetry, onSignOut }: {
  phase?: StartupPhase;
  error?: string;
  onRetry?: () => Promise<void>;
  onSignOut?: () => Promise<void>;
}) {
  useLocaleSubscription();
  const signOut = useActionFeedback();
  return (
    <div className="app-start-surface grid place-items-center">
      <div className="t-startup-sequence flex flex-col items-center gap-3 text-center">
        <BrandLockup className="t-startup-brand flex-col gap-2 [&>span:last-child]:text-2xl" markClassName="size-24 rounded-3xl p-4" />
        {error ? <div className="grid max-w-sm gap-4 px-5">
          <p role="alert" className="text-sm leading-6 text-muted-foreground">{translate(error)}</p>
          <div className="flex justify-center gap-2">
            {onRetry ? <Button disabled={signOut.busy} onClick={() => void onRetry()}>{translate("common.retry")}</Button> : null}
            {onSignOut ? <Button aria-busy={signOut.busy} disabled={signOut.busy} onClick={() => void signOut.run(onSignOut).catch((caught: unknown) => {
              toast.error(caught instanceof Error ? caught.message : translate("auth.serviceUnavailable"));
            })} variant="ghost">{signOut.busy ? <LoadingSpinner /> : null}{translate("auth.signOutLabel")}</Button> : null}
          </div>
        </div> : <StartupStatus key={phase} phase={phase} />}
      </div>
    </div>
  );
}
