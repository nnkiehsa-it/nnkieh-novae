import { ADMIN_PERIOD_FIGURES, adminOverviewWindowLabelKey, type AdminOverviewWindow } from "@/constants/admin-activity";
import type { AdminOverviewData } from "@/hooks/use-admin-overview";
import { useI18n } from "@/i18n";
import { Skeleton } from "@/ui/feedback";
import { ListGroup, ListRow } from "@/ui/list";
import { Panel } from "@/ui/panel";
import { AnimatedNumber, FigureGrid } from "../shared/figures";
import { DetailRow } from "../shared/rows";
import { ActivityBreakdown } from "./activity-breakdown";

/**
 * The headline figures, and the period's four counts. Each count with
 * something behind it opens onto its own share of the period's activity.
 */
export function OverviewMetrics({ activity, canOpenActivity, period }: {
  activity: AdminOverviewData | null;
  /** Whether this reader may open the full record of what happened. */
  canOpenActivity: boolean;
  period: AdminOverviewWindow;
}) {
  const { t } = useI18n();
  const periodLabel = t(adminOverviewWindowLabelKey(period));
  const headline = [
    { label: t("ui.adminConsole.registeredUsers"), count: activity?.totalUsers },
    { label: t("ui.adminConsole.active24h"), count: activity?.activeUsers24h },
    { label: t("ui.adminConsole.active7d"), count: activity?.activeUsers7d },
    { label: t("ui.adminConsole.active30d"), count: activity?.activeUsers30d },
  ];

  return (
    <>
      <Panel>
        <FigureGrid figures={headline.map(({ count, label }) => ({
          label,
          value: count === undefined ? undefined : <AnimatedNumber value={count} />,
        }))} />
      </Panel>
      <ListGroup title={`${t("ui.adminConsole.period")} · ${periodLabel}`}>
        {ADMIN_PERIOD_FIGURES.map(({ countKey, kind, labelKey }) => {
          const count = activity?.[countKey];
          const label = t(labelKey);
          const figure = count === undefined ? <Skeleton className="h-5 w-10" /> : <AnimatedNumber className="font-semibold" value={count} />;
          if (!count) return <ListRow key={kind} label={label} value={figure} />;
          return (
            <DetailRow key={kind} label={label} title={label} value={figure}>
              <ActivityBreakdown
                count={count}
                entries={(activity?.recentActivity ?? []).filter((entry) => entry.kind === kind)}
                period={periodLabel}
              />
            </DetailRow>
          );
        })}
        {canOpenActivity ? <ListRow href="/admin/audit?view=activity" label={t("ui.adminConsole.viewAllActivity")} /> : null}
      </ListGroup>
    </>
  );
}
