"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";

import { useI18n } from "@/i18n";
import { useAdminOverview, type AdminOverviewWindow } from "@/hooks/use-admin-overview";
import { AdminActivityRows } from "@/components/admin/admin-activity-feed";
import { AdminSections } from "@/components/admin/admin-sections";
import { OverviewDistribution, OverviewMetrics } from "@/components/admin/overview-metrics";
import { OverviewHealth } from "@/components/admin/overview-health";
import { Button } from "@/components/ui/button";
import { ListNavRow, ListSection } from "@/components/ui/list";
import { LiquidTabs } from "@/components/ui/liquid-tabs";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ErrorState } from "@/components/ui/page-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdminAccess } from "@/lib/admin-routes";

const WINDOWS: ReadonlyArray<{ labelKey: string; value: AdminOverviewWindow }> = [
  { labelKey: "ui.adminConsole.window24h", value: "24h" },
  { labelKey: "ui.adminConsole.window7d", value: "7d" },
  { labelKey: "ui.adminConsole.window30d", value: "30d" },
];

export function AdminOverview({ access }: { access: AdminAccess }) {
  const { t } = useI18n();
  const [period, setPeriod] = React.useState<AdminOverviewWindow>("24h");
  const { activity, error, load, loading, platform } = useAdminOverview(period);
  const periodLabel = t(WINDOWS.find((entry) => entry.value === period)?.labelKey ?? "");

  return (
    <div className="space-y-7" data-dashboard-surface>
      {access.overview ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <LiquidTabs
              ariaLabel={t("ui.adminConsole.period")}
              onValueChange={(value) => setPeriod(value as AdminOverviewWindow)}
              options={WINDOWS.map((entry) => ({
                label: t(entry.labelKey),
                value: entry.value,
              }))}
              value={period}
            />
            <Button
              aria-label={t("ui.adminConsole.refresh")}
              disabled={loading}
              onClick={() => void load(true)}
              size="icon-sm"
              variant="ghost"
            >
              {loading ? <LoadingSpinner /> : <RefreshCw className="size-4" />}
            </Button>
          </div>

          {error ? <ErrorState error={error} onRetry={() => void load(true)} /> : null}

          <OverviewMetrics activity={activity} period={periodLabel} />
          <OverviewDistribution platform={platform} />
          <OverviewHealth canOpenSystem={access.admin} platform={platform} />

          <ListSection header={t("ui.adminConsole.recentActivity")}>
            {!activity ? (
              <div className="space-y-3 py-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <AdminActivityRows entries={activity.recentActivity.slice(0, 5)} />
            )}
            {access.members ? (
              <ListNavRow href="/admin/audit" label={t("ui.adminConsole.viewAllActivity")} />
            ) : null}
          </ListSection>
        </>
      ) : null}

      <AdminSections access={access} />
    </div>
  );
}
