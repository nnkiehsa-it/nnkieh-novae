"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import { Users } from "lucide-react";
import { BrandLockup } from "@/components/ui/brand";
import { Card } from "@/components/ui/card";

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
