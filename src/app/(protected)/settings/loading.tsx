"use client";

import { Bell, Download, Sun } from "lucide-react";
import { t } from "@/i18n";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-state";
import { Skeleton } from "@/components/ui/skeleton";

function StableSettingsCard({
  icon: Icon,
  title,
}: {
  icon: typeof Bell;
  title: string;
}) {
  return (
    <Card className="gap-4 p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <Icon className="size-4 text-muted-foreground" />
        {title}
      </h2>
      <div className="space-y-3">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-8 w-full rounded-full" />
      </div>
    </Card>
  );
}

export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl space-y-5" aria-busy="true">
      <PageHeader title={t("ui.nav.settings")} />
      <Card className="gap-3 p-5">
        <div className="flex items-center gap-3">
          <Skeleton className="size-11 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-52 max-w-full" />
          </div>
        </div>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <StableSettingsCard icon={Sun} title={t("ui.settings.appearance")} />
        <StableSettingsCard icon={Download} title={t("ui.settings.install")} />
      </div>
      <StableSettingsCard icon={Bell} title={t("ui.settings.push")} />
    </div>
  );
}
