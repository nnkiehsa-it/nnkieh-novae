"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Liquid } from "liquid-gooey";
import { ArrowRight, Blocks, Check } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { BrandLockup } from "@/components/ui/brand";
import { Card } from "@/components/ui/card";
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
    <main className="relative grid min-h-[100dvh] overflow-hidden bg-[var(--surface-stage)] lg:grid-cols-[1.08fr_.92fr]">
      <section className="relative hidden min-h-[100dvh] overflow-hidden border-r bg-background p-12 lg:flex lg:flex-col lg:justify-between">
        <BrandLockup />
        <div className="relative mx-auto w-full max-w-xl">
          <div className="relative h-[26rem]">
            <Liquid
              blur={6}
              className="absolute inset-0"
              contrast={19}
              fill="var(--card)"
              filterPadding={8}
              shadow="var(--shadow-floating)"
            >
              <Liquid.Item
                delay={0}
                morph={{ bounce: 0.24, contentBlur: 2, shape: true, speed: 1.2 }}
                radius={20}
                x={18}
                y={6}
              >
                <Card className="w-80 gap-4 p-5">
                  <div className="flex items-start justify-between">
                    <span className="grid size-9 place-items-center rounded-xl bg-muted">
                      <Blocks className="size-4" />
                    </span>
                    <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">{t('ui.status.processing')}</span>
                  </div>
                  <div>
                    <p className="font-semibold">{t('ui.login.heroTitle')}</p>
                    <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{t('ui.login.heroDescription')}</p>
                  </div>
                </Card>
              </Liquid.Item>
              <Liquid.Item
                delay={80}
                morph={{ bounce: 0.32, contentBlur: 1, shape: true, speed: 1.15 }}
                radius={18}
                x={272}
                y={158}
              >
                <Card className="w-56 gap-3 p-4">
                  <p className="text-xs font-medium text-muted-foreground">{t('ui.login.weeklyActivity')}</p>
                  <p className="text-3xl font-semibold tracking-[-0.04em] tabular-nums">
                    1,248
                  </p>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full w-3/4 rounded-full bg-foreground" />
                  </div>
                </Card>
              </Liquid.Item>
              <Liquid.Item
                delay={140}
                morph={{ bounce: 0.2, contentBlur: 1, shape: true, speed: 1.3 }}
                radius={999}
                x={18}
                y={196}
              >
                <span className="flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium">
                  <Check className="size-4 text-success" />{t('ui.login.synced')}</span>
              </Liquid.Item>
            </Liquid>
          </div>
          <h1 className="mt-8 max-w-md text-4xl font-semibold leading-[1.08] tracking-[-0.045em]">{t('ui.login.heading')}</h1>
          <p className="mt-4 max-w-md text-sm leading-7 text-muted-foreground">{t('ui.login.subheading')}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Secure campus participation platform
        </p>
      </section>

      <section className="flex min-h-[100dvh] items-center justify-center px-4 py-12 sm:px-8">
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
