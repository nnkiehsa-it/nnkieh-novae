import * as React from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ArrowClockwise, ArrowRight } from "@phosphor-icons/react/ssr";
import { useI18n } from "@/i18n";
import { sameOriginUrl } from "@/lib/same-origin-url";
import { useLoginEntrance } from "@/hooks/use-login-entrance";
import { useSession } from "@/hooks/use-session";
import { TurnstileInlineHost } from "@/features/security/turnstile";
import { BrandLockup } from "@/features/shell/brand";
import { StartupScreen } from "@/features/shell/startup-screen";
import { Button } from "@/ui/button";
import { Panel } from "@/ui/panel";

function GoogleMark() {
  return (
    <svg aria-hidden className="size-[1.125rem]" viewBox="0 0 24 24">
      <path d="M21.6 12.23c0-.71-.06-1.4-.19-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.4Z" fill="#4285F4" />
      <path d="M12 22c2.7 0 4.98-.9 6.63-2.43l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z" fill="#34A853" />
      <path d="M6.39 13.86A6.02 6.02 0 0 1 6.08 12c0-.65.11-1.28.31-1.86V7.52H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.48l3.35-2.62Z" fill="#FBBC05" />
      <path d="M12 6.01c1.47 0 2.78.5 3.82 1.49l2.87-2.87A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.96 5.52l3.35 2.62C7.18 7.77 9.39 6.01 12 6.01Z" fill="#EA4335" />
    </svg>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const session = useSession();
  const { initialized, prepareLogin, roleLoading, setupCompleted, startupError, user } = session;
  const { t } = useI18n();
  const entrance = useLoginEntrance(initialized && !user, prepareLogin);

  // A signed-in visitor goes where they were headed, or to setup first.
  React.useEffect(() => {
    if (!initialized || !user || roleLoading || startupError) return;
    const target = new URL(setupCompleted ? sameOriginUrl(search.get("redirect"), window.location.origin, "/home") : "/setup");
    void navigate(`${target.pathname}${target.search}${target.hash}`, { replace: true });
  }, [initialized, navigate, roleLoading, search, setupCompleted, startupError, user]);

  if (startupError) return <StartupScreen error={startupError} onRetry={session.retryStartup} onSignOut={session.logout} steps={session.startupSteps} />;
  if (!initialized || user) return <StartupScreen steps={session.startupSteps} />;

  const checking = entrance.phase === "checking";
  const busy = checking || session.loginBusy;
  const error = entrance.error || session.error;
  return (
    <main className="mx-auto grid min-h-svh w-full max-w-6xl items-center gap-12 px-[var(--gutter)] py-[max(2.5rem,var(--safe-top))] lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
      <section className="hidden gap-6 lg:grid">
        <BrandLockup markClassName="rounded-icon" />
        <h1 className="max-w-lg text-balance text-5xl font-semibold leading-[1.1] tracking-tight">{t("ui.login.heading")}</h1>
        <p className="max-w-md text-base leading-relaxed text-ink-muted">{t("ui.login.subheading")}</p>
        <img alt="" className="max-h-[32svh] w-auto opacity-90" decoding="async" fetchPriority="high" height={360} src="/novae-constellation.webp" width={240} />
      </section>
      <Panel className="mx-auto grid w-full max-w-md gap-7 p-6 sm:p-8">
        <BrandLockup className="lg:hidden" markClassName="rounded-icon" />
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{t("auth.signInWithASchoolAccount")}</h2>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-muted">
            {t("auth.useYour")}{" "}
            <strong className="font-medium text-ink">{session.allowedDomain || t("auth.configuredSchoolDomain")}</strong>{" "}
            {t("auth.toContinue")}
          </p>
        </div>
        <TurnstileInlineHost />
        <Button
          className="w-full"
          onClick={() => (entrance.phase === "error" ? entrance.retry() : void session.login())}
          size="lg"
          status={busy ? "loading" : "idle"}
          variant="primary"
        >
          {busy ? (
            t(session.loginBusy ? "auth.signingIn" : "auth.verifyingSecurity")
          ) : entrance.phase === "error" ? (
            <><ArrowClockwise weight="bold" />{t("auth.retryVerification")}</>
          ) : (
            <><GoogleMark />{t("auth.signInWithGoogle")}<ArrowRight className="ml-auto" weight="bold" /></>
          )}
        </Button>
        {error ? (
          <p className="break-words rounded-tile bg-danger/12 px-4 py-3 text-sm leading-relaxed text-danger" data-error="true" role="alert">{t(error)}</p>
        ) : null}
        <p className="text-center text-xs leading-relaxed text-ink-faint">{t("ui.login.terms")}</p>
      </Panel>
    </main>
  );
}
