"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";

import { useI18n } from "@/i18n";
import {
  ADMIN_OVERVIEW_WINDOWS,
  type AdminOverviewWindow,
} from "@/constants/admin-activity";
import { useAdminOverview } from "@/hooks/use-admin-overview";
import { AdminSections } from "@/components/admin/admin-sections";
import { OverviewDistribution, OverviewMetrics } from "@/components/admin/overview-metrics";
import { OverviewHealth } from "@/components/admin/overview-health";
import { Button } from "@/components/ui/button";
import { LiquidTabs } from "@/components/ui/liquid-tabs";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ErrorState } from "@/components/ui/page-state";
import type { AdminAccess } from "@/lib/admin-routes";

export function AdminOverview({ access }: { access: AdminAccess }) {
  const { t } = useI18n();
  const [period, setPeriod] = React.useState<AdminOverviewWindow>("24h");
  const { activity, error, load, loading, platform } = useAdminOverview(period);

  return (
    <div className="space-y-7" data-dashboard-surface>
      {access.overview ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <LiquidTabs
              ariaLabel={t("ui.adminConsole.period")}
              onValueChange={(value) => setPeriod(value as AdminOverviewWindow)}
              options={ADMIN_OVERVIEW_WINDOWS.map((entry) => ({
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

          <OverviewMetrics
            activity={activity}
            canOpenActivity={access.members}
            period={period}
          />
          <OverviewDistribution platform={platform} />
          <OverviewHealth canOpenSystem={access.admin} platform={platform} />
        </>
      ) : null}

      <AdminSections access={access} />
    </div>
  );
}
