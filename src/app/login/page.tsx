"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Block, BlockFooter, LoginScreenTitle } from "framework7-react";
import { RefreshCw } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { useLoginEntrance } from "@/hooks/use-login-entrance";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { BrandLockup } from "@/components/ui/brand";
import { BusyLabel } from "@/components/ui/page-state";
import { TurnstileInlineHost } from "@/components/turnstile-provider";
import { AppStartupScreen } from "@/components/app-startup-screen";
import { useStartupPresentation } from "@/hooks/use-startup-presentation";
import { RouteSurface } from "@/components/motion/route-surface";
import { sameOriginUrl } from "@/lib/same-origin-url";

function GoogleMark() {
  return (
    <svg aria-hidden className="size-4" viewBox="0 0 24 24">
      <path
        d="M21.6 12.23c0-.71-.06-1.4-.19-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.4Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.7 0 4.98-.9 6.63-2.43l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.39 13.86A6.02 6.02 0 0 1 6.08 12c0-.65.11-1.28.31-1.86V7.52H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.48l3.35-2.62Z"
        fill="#FBBC05"
      />
      <path
        d="M12 6.01c1.47 0 2.78.5 3.82 1.49l2.87-2.87A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.96 5.52l3.35 2.62C7.18 7.77 9.39 6.01 12 6.01Z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const search = useSearchParams();
  const session = useSession();
  const {
    initialized,
    prepareLogin,
    restoringSession,
    roleLoading,
    setupCompleted,
    startupError,
    user,
  } = session;
  const { phase: startupPhase, pending: presentingStartup } = useStartupPresentation(session);
  const { t } = useI18n();
  const entrance = useLoginEntrance(initialized && !user, prepareLogin);

  React.useEffect(() => {
    if (!initialized || !user || roleLoading || startupError || presentingStartup) return;
    const requested = search.get("redirect");
    router.replace(
      !setupCompleted
        ? "/setup"
        : sameOriginUrl(requested, window.location.origin, "/home"),
    );
  }, [
    router,
    search,
    initialized,
    roleLoading,
    setupCompleted,
    startupError,
    presentingStartup,
    user,
  ]);

  if (startupError) return <AppStartupScreen phase={startupPhase} error={startupError} onRetry={session.retryStartup} onSignOut={session.logout} />;
  if (!initialized || restoringSession || user) return <AppStartupScreen phase={startupPhase} />;

  return (
    <RouteSurface loginScreen>
      <main>
        <Block><BrandLockup className="justify-center" /></Block>
        <LoginScreenTitle>
          <h1 className="m-0 font-[inherit] text-[length:inherit] leading-[inherit]">
            {t("auth.signInWithASchoolAccount")}
          </h1>
        </LoginScreenTitle>
        <Block className="text-align-center">
          <p>
            {t("auth.useYour")}{" "}
            <strong>{session.allowedDomain || t("auth.configuredSchoolDomain")}</strong>{" "}
            {t("auth.toContinue")}
          </p>
          <TurnstileInlineHost />
        </Block>
        <Block>
          <Button
            className="w-full"
            aria-busy={entrance.phase === "checking" || session.loginBusy}
            disabled={entrance.phase === "checking" || session.loginBusy}
            onClick={() => entrance.phase === "error" ? entrance.retry() : void session.login()}
            size="lg"
          >
            {entrance.phase === "checking" || session.loginBusy ? (
              <BusyLabel
                busy
                busyLabel={t(session.loginBusy ? "auth.signingIn" : "auth.preparingSignIn")}
                label={t("auth.signInWithGoogle")}
              />
            ) : entrance.phase === "error" ? (
              <><RefreshCw />{t("auth.retryVerification")}</>
            ) : (
              <><GoogleMark />{t("auth.signInWithGoogle")}</>
            )}
          </Button>
        </Block>
        {session.error || entrance.error ? (
          <BlockFooter className="text-color-red">
            <p className="break-words" data-error="true" role="alert">
              {t(entrance.error || session.error)}
            </p>
          </BlockFooter>
        ) : null}
        <BlockFooter><p>{t("ui.login.terms")}</p></BlockFooter>
      </main>
    </RouteSurface>
  );
}
