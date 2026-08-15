"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { BrandLockup } from "@/components/ui/brand";
import { BusyLabel } from "@/components/ui/page-state";

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
  const { t } = useI18n();

  React.useEffect(() => {
    if (!session.initialized || !session.user || session.roleLoading) return;
    const requested = search.get("redirect");
    router.replace(
      !session.setupCompleted
        ? "/setup"
        : requested?.startsWith("/") && !requested.startsWith("//")
          ? requested
          : "/issues",
    );
  }, [
    router,
    search,
    session.initialized,
    session.roleLoading,
    session.setupCompleted,
    session.user,
  ]);

  return (
    <main className="relative grid min-h-[100svh] overflow-hidden bg-[var(--surface-stage)] lg:grid-cols-[1.08fr_.92fr]">
      <section className="relative hidden min-h-[100svh] overflow-hidden border-r bg-background p-12 lg:grid lg:place-items-center">
        <BrandLockup className="t-panel-reveal absolute top-12 left-12" />
        <div className="t-stagger-list w-full max-w-xl">
          <h1 className="t-stagger-item max-w-lg text-4xl font-semibold leading-[1.08] tracking-[-0.045em] text-balance">
            {t("ui.login.heading")}
          </h1>
          <p className="t-stagger-item mt-5 max-w-md text-sm leading-7 text-muted-foreground">
            {t("ui.login.subheading")}
          </p>
        </div>
      </section>

      <section className="flex min-h-[100svh] items-center justify-center px-4 py-12 sm:px-8">
        <div className="t-panel-reveal w-full max-w-sm">
          <div className="mb-7 space-y-4">
            <BrandLockup className="lg:hidden" />
            <div>
              <h1 className="text-2xl font-semibold tracking-[-0.03em]">
                {t("auth.signInWithASchoolAccount")}
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {t("auth.useYour")}{" "}
                <strong className="font-medium text-foreground">
                  {session.allowedDomain || t("auth.configuredSchoolDomain")}
                </strong>{" "}
                {t("auth.toContinue")}
              </p>
            </div>
          </div>
          <Button
            className="group w-full"
            disabled={session.loginBusy}
            onClick={() => void session.login()}
            size="lg"
          >
            {session.loginBusy ? (
              <BusyLabel
                busy
                busyLabel={t("auth.signingIn")}
                label={t("auth.signInWithGoogle")}
              />
            ) : (
              <>
                <GoogleMark />
                {t("auth.signInWithGoogle")}
                <ArrowRight className="ml-auto transition-transform duration-250 ease-[var(--ease-smooth-out)] group-hover:translate-x-0.5" />
              </>
            )}
          </Button>
          {session.error ? (
            <p
              className="t-shake mt-3 rounded-lg bg-destructive/8 p-3 text-sm leading-5 text-destructive"
              data-error="true"
            >
              {t(session.error)}
            </p>
          ) : null}
          <p className="mt-5 text-center text-xs leading-5 text-muted-foreground">{t('ui.login.terms')}</p>
        </div>
      </section>
    </main>
  );
}
