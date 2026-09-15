"use client";

import { useI18n } from "@/i18n";
import { AdminActivityRows } from "@/components/admin/admin-activity-feed";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { ListCustomRow, ListRow, ListSection } from "@/components/ui/list";
import { ErrorState } from "@/components/ui/page-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  adminOverviewWindowLabelKey,
  type AdminOverviewWindow,
  type AdminPeriodFigure,
} from "@/constants/admin-activity";
import { useAdminOverview } from "@/hooks/use-admin-overview";

/**
 * What one of the overview's period figures is made of.
 *
 * The figure used to open a drawer underneath itself, which pushed the three
 * figures below it down the screen and asked a list that can run to a hundred
 * entries to live inside a row. It is a screen of its own instead, read out of
 * the same reading the overview already holds, so arriving here costs no
 * request of its own.
 */
export function ActivityBreakdown({
  figure,
  period,
}: {
  figure: AdminPeriodFigure;
  period: AdminOverviewWindow;
}) {
  const { t } = useI18n();
  const { activity, error, load, loading } = useAdminOverview(period);
  const count = activity?.[figure.countKey];
  const entries = (activity?.recentActivity ?? []).filter(
    (entry) => entry.kind === figure.kind,
  );

  if (error) return <ErrorState error={error} onRetry={() => void load(true)} />;

  return (
    <ListSection
      header={t(adminOverviewWindowLabelKey(period))}
      headerAction={
        count === undefined ? (
          <Skeleton className="h-4 w-8" />
        ) : (
          <AnimatedNumber
            className="text-xs font-semibold tabular-nums text-muted-foreground"
            value={count}
          />
        )
      }
    >
      {entries.length > 0 ? (
        <AdminActivityRows entries={entries} showKind={false} />
      ) : (
        <ListRow
          label={
            loading || count === undefined
              ? t("ui.common.loadingMore")
              : t("ui.adminConsole.noRecentActivity")
          }
        />
      )}
      {count !== undefined && entries.length > 0 && entries.length < count ? (
        <ListCustomRow className="text-xs text-muted-foreground">
          {t("ui.adminConsole.activityShown", { shown: entries.length })}
        </ListCustomRow>
      ) : null}
    </ListSection>
  );
}
