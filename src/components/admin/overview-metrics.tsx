"use client";

import { useI18n } from "@/i18n";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { ListCustomRow, ListNavRow, ListRow, ListSection } from "@/components/ui/list";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusDistribution } from "@/components/ui/status-distribution";
import { getIssueCategoryLabel } from "@/constants/categories";
import {
  ADMIN_PERIOD_FIGURES,
  adminOverviewWindowLabelKey,
  type AdminOverviewWindow,
} from "@/constants/admin-activity";
import type { AdminOverviewData } from "@/hooks/use-admin-overview";
import type { PlatformDashboardData } from "@/types";

/**
 * The headline figures.
 *
 * They sit on a plain band rather than in four separate cards: four cards make
 * four objects out of one reading, and a reading is easier to compare when the
 * numbers share a baseline. Nothing is ruled off from anything else -- the
 * figures are one reading, and lines between them drew three borders through
 * it. Two to a row is the narrowest the band goes -- one figure per row turned
 * four comparable numbers into a column to scroll.
 *
 * What happened during the period used to be listed a second time underneath,
 * as one undifferentiated feed that answered none of the four figures above it.
 * Each figure leads to its own share of it instead, on a screen of its own: a
 * drawer that pushed the rest of the list down was the wrong shape for a record
 * that can run to a hundred entries.
 */
export function OverviewMetrics({
  activity,
  canOpenActivity,
  period,
}: {
  activity: AdminOverviewData | null;
  /** Whether this reader may open the full record of what happened. */
  canOpenActivity: boolean;
  period: AdminOverviewWindow;
}) {
  const { t } = useI18n();
  const headline = [
    [t("ui.adminConsole.registeredUsers"), activity?.totalUsers],
    [t("ui.adminConsole.active24h"), activity?.activeUsers24h],
    [t("ui.adminConsole.active7d"), activity?.activeUsers7d],
    [t("ui.adminConsole.active30d"), activity?.activeUsers30d],
  ] as const;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 px-1 lg:grid-cols-4">
        {headline.map(([label, value]) => (
          <div key={label}>
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            {value === undefined ? (
              <Skeleton className="mt-1 h-9 w-16" />
            ) : (
              <AnimatedNumber
                className="mt-1 text-3xl font-semibold tracking-[-0.04em]"
                value={value}
              />
            )}
          </div>
        ))}
      </div>

      <ListSection header={t("ui.adminConsole.period")} headerAction={
        <span className="text-xs text-muted-foreground">
          {t(adminOverviewWindowLabelKey(period))}
        </span>
      }>
        {ADMIN_PERIOD_FIGURES.map(({ countKey, kind, labelKey }) => {
          const count = activity?.[countKey];
          const label = t(labelKey);
          const figure =
            count === undefined ? (
              <Skeleton className="h-5 w-10" />
            ) : (
              <AnimatedNumber className="font-semibold tabular-nums" value={count} />
            );
          if (!count) return <ListRow key={kind} label={label} value={figure} />;
          return (
            <ListNavRow
              href={`/admin/activity/${kind}?window=${period}`}
              key={kind}
              label={label}
              value={figure}
            />
          );
        })}
        {canOpenActivity ? (
          <ListNavRow href="/admin/audit" label={t("ui.adminConsole.viewAllActivity")} />
        ) : null}
      </ListSection>
    </div>
  );
}

/**
 * Where the issues actually are, as a share of the whole — drawn by the same
 * component the proposal feed uses for its statuses, rather than by a second
 * bar chart that only administration knows about.
 */
export function OverviewDistribution({ platform }: { platform: PlatformDashboardData | null }) {
  const { t } = useI18n();
  const byCategory = platform?.stats.issues_by_category;
  const entries = Object.entries(byCategory ?? {}).toSorted((left, right) => right[1] - left[1]);
  const segments = entries.map(([category, count], index) => ({
    color: "var(--tint-content)",
    count,
    fill: `color-mix(in oklab, var(--tint-content) ${Math.max(30, 100 - index * 16)}%, var(--muted))`,
    key: category,
    label: getIssueCategoryLabel(category),
  }));

  return (
    <ListSection header={t("ui.dashboard.categoryDistribution")}>
      <ListCustomRow>
        <StatusDistribution
          ariaLabel={t("ui.dashboard.categoryDistribution")}
          loading={!byCategory}
          segments={segments}
        />
      </ListCustomRow>
    </ListSection>
  );
}
