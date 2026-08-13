"use client";

import { ArrowLeft, RefreshCw } from "lucide-react";
import { t, useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-state";
import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  useI18n();
  return (
    <div className="space-y-5" aria-busy="true">
      <PageHeader
        actions={
          <>
            <Button disabled variant="ghost">
              <ArrowLeft />{t("ui.common.back")}
            </Button>
            <Button disabled variant="outline">
              <RefreshCw />{t("ui.dashboard.refresh")}
            </Button>
          </>
        }
        title={t("ui.nav.dashboard")}
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Card className="gap-5 p-5" key={index}>
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="size-8 rounded-xl" />
            </div>
            <Skeleton className="h-9 w-20" />
          </Card>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(18rem,.75fr)]">
        <Card className="min-h-64 p-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-2 w-full rounded-full" />
          <Skeleton className="h-2 w-4/5 rounded-full" />
          <Skeleton className="h-2 w-3/5 rounded-full" />
        </Card>
        <Card className="min-h-64 p-6">
          <Skeleton className="h-5 w-32" />
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton className="h-16 rounded-xl" key={index} />
            ))}
          </div>
        </Card>
      </div>
      <Card className="min-h-44 p-6">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-14 w-full rounded-xl" />
      </Card>
    </div>
  );
}
