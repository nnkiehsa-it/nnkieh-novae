"use client";

import { ADMIN_OVERVIEW_WINDOWS } from "@/constants/admin-activity";
import { useAdminOverview } from "@/hooks/use-admin-overview";
import { useAdminView } from "@/hooks/use-admin-view";
import { useI18n } from "@/i18n";
import type { AdminAccess } from "@/lib/admin-routes";
import { Segmented } from "@/ui/segmented";
import { LoadError } from "../shared/feedback";
import { RefreshButton } from "../shared/icon-actions";
import { CategoryShare } from "./category-share";
import { OperationsHealth } from "./operations-health";
import { OverviewMetrics } from "./overview-metrics";

const PERIODS = ADMIN_OVERVIEW_WINDOWS.map((window) => window.value);

/** Registrations, activity, where the proposals are, and what needs attention, over a chosen period. */
export function ActivityOverview({ access }: { access: AdminAccess }) {
  const { t } = useI18n();
  const [period, setPeriod] = useAdminView(PERIODS, "period");
  const { activity, error, load, loading, platform } = useAdminOverview(period);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label={t("ui.adminConsole.period")}
          onChange={setPeriod}
          options={ADMIN_OVERVIEW_WINDOWS.map((window) => ({ label: t(window.labelKey), value: window.value }))}
          value={period}
        />
        <RefreshButton loading={loading} onClick={() => void load(true)} />
      </div>
      {error ? <LoadError message={error} onRetry={() => void load(true)} /> : null}
      <OverviewMetrics activity={activity} canOpenActivity={access.members} period={period} />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <CategoryShare platform={platform} />
        <OperationsHealth canOpenSystem={access.admin} platform={platform} />
      </div>
    </div>
  );
}
