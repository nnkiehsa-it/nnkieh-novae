"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useI18n } from "@/i18n";
import { ADMIN_OVERVIEW_WINDOWS, type AdminOverviewWindow } from "@/constants/admin-activity";
import { useAdminOverview } from "@/hooks/use-admin-overview";
import { OverviewDistribution, OverviewMetrics } from "@/components/admin/overview-metrics";
import { Button } from "@/components/ui/button";
import { LiquidTabs } from "@/components/ui/liquid-tabs";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ErrorState } from "@/components/ui/page-state";

export function HomeStatistics({ canOpenActivity }: { canOpenActivity: boolean }) {
  const { t } = useI18n();
  const [period, setPeriod] = useState<AdminOverviewWindow>("24h");
  const { activity, error, load, loading, platform } = useAdminOverview(period);
  return (
    <section className="space-y-5" data-dashboard-surface aria-label={t("ui.home.statistics")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{t("ui.home.statistics")}</h2>
        <div className="flex items-center gap-2">
          <LiquidTabs ariaLabel={t("ui.adminConsole.period")} value={period}
            onValueChange={(value) => setPeriod(value as AdminOverviewWindow)}
            options={ADMIN_OVERVIEW_WINDOWS.map((entry) => ({ label: t(entry.labelKey), value: entry.value }))} />
          <Button aria-label={t("ui.adminConsole.refresh")} disabled={loading} onClick={() => void load(true)} size="icon-sm" variant="ghost">
            {loading ? <LoadingSpinner /> : <RefreshCw className="size-4" />}
          </Button>
        </div>
      </div>
      {error ? <ErrorState error={error} onRetry={() => void load(true)} /> : null}
      <OverviewMetrics activity={activity} canOpenActivity={canOpenActivity} period={period} />
      <OverviewDistribution platform={platform} />
    </section>
  );
}
