"use client";

import * as React from "react";
import "@/styles/login.css";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, RefreshCw } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { useLoginEntrance } from "@/hooks/use-login-entrance";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { BrandLockup } from "@/components/ui/brand";
import { LoginStory } from "@/components/login/login-story";
import { BusyLabel } from "@/components/ui/page-state";
import { TurnstileInlineHost } from "@/components/turnstile-provider";
import { AppStartupScreen } from "@/components/protected-app";
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
    startupPhase,
    user,
  } = session;
  const { t } = useI18n();
  const entrance = useLoginEntrance(initialized && !user, prepareLogin);

  React.useEffect(() => {
    if (!initialized || !user || roleLoading) return;
    const requested = search.get("redirect");
    router.replace(
      !setupCompleted
        ? "/setup"
        : sameOriginUrl(requested, window.location.origin, "/issues"),
    );
  }, [
    router,
    search,
    initialized,
    roleLoading,
    setupCompleted,
    user,
  ]);

  if (restoringSession || (user && roleLoading)) return <AppStartupScreen phase={startupPhase} />;

  return (
    <RouteSurface className="!w-full">
      <main className="login-page">
        <header className="login-header t-panel-reveal"><BrandLockup /></header>
        <div className="login-layout">
          <LoginStory />
          <section className="login-form t-panel-reveal" aria-labelledby="login-form-title">
          <div className="mb-6 space-y-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-[-0.03em]" id="login-form-title">
                {t("auth.signInWithASchoolAccount")}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {t("auth.useYour")}{" "}
                <strong className="font-medium text-foreground">
                  {session.allowedDomain || t("auth.configuredSchoolDomain")}
                </strong>{" "}
                {t("auth.toContinue")}
              </p>
            </div>
          </div>
          <div className="space-y-5">
            <TurnstileInlineHost />
            <Button
              className="group w-full"
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
                <>
                  <GoogleMark />
                  {t("auth.signInWithGoogle")}
                  <ArrowRight className="ml-auto transition-transform duration-[var(--motion-control)] ease-[var(--ease-arrive)] group-hover:translate-x-0.5" />
                </>
              )}
            </Button>
          </div>
          {session.error || entrance.error ? (
            <p
              className="t-shake mt-3 break-words rounded-lg bg-destructive/8 p-3 text-sm leading-5 text-destructive"
              data-error="true"
              role="alert"
            >
              {t(entrance.error || session.error)}
            </p>
          ) : null}
          <p className="mt-5 text-center text-xs leading-5 text-muted-foreground">{t('ui.login.terms')}</p>
          </section>
        </div>
      </main>
    </RouteSurface>
  );
}
