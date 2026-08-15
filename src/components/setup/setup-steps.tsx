"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import { Check, ChevronRight, Languages, Users } from "lucide-react";
import { setLocale, type AppLocale } from "@/i18n";
import { Button } from "@/components/ui/button";
import { BrandLockup } from "@/components/ui/brand";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-state";

export function SetupBrand() {
  useLocaleSubscription();
  return (
    <BrandLockup className="mb-12" />
  );
}

export function SetupWaitingState() {
  return (
    <main className="grid min-h-[100svh] place-items-center bg-[var(--surface-stage)] p-4">
      <Card className="t-panel-reveal w-full max-w-lg items-center px-6 py-12 text-center">
        <span className="grid size-11 place-items-center rounded-2xl bg-muted">
          <Users className="size-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold">{translate('ui.setup.waitTitle')}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{translate('ui.setup.waitDescription')}</p>
        </div>
        <p
          className="t-shimmer text-sm text-muted-foreground"
          data-text={translate('ui.setup.checking')}
        >{translate('ui.setup.checking')}</p>
      </Card>
    </main>
  );
}

export function SetupLanguageStep({
  locale,
  onContinue,
}: {
  locale: AppLocale;
  onContinue: () => void;
}) {
  return (
    <section className="t-panel-reveal mx-auto max-w-xl">
      <PageHeader title={translate('ui.setup.languageTitle')} />
      <div className="mt-8 grid gap-3">
        {(
          [
            ["zh-TW", translate('ui.setup.zhTraditional')],
            ["en", "English"],
          ] as const
        ).map(([value, label]) => (
          <button
            className="t-card flex min-h-16 items-center gap-4 rounded-xl border bg-card px-5 text-left shadow-[var(--shadow-card)] sm:px-6"
            key={value}
            onClick={() => setLocale(value)}
            type="button"
          >
            <span className="grid size-8 place-items-center rounded-lg bg-muted">
              <Languages className="size-4" />
            </span>
            <span className="flex-1 font-medium">{label}</span>
            {locale === value ? (
              <span
                className="t-success-check grid size-6 place-items-center rounded-full bg-foreground text-background"
                data-state="in"
              >
                <Check className="size-3.5" />
              </span>
            ) : null}
          </button>
        ))}
      </div>
      <div className="mt-8 flex justify-end">
        <Button onClick={onContinue}>{translate('ui.setup.continue')}<ChevronRight />
        </Button>
      </div>
    </section>
  );
}
