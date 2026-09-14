"use client";

import { useI18n } from "@/i18n";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { ListCustomRow, ListRow, ListSection } from "@/components/ui/list";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusDistribution } from "@/components/ui/status-distribution";
import { getIssueCategoryLabel } from "@/constants/categories";
import type { AdminOverviewData } from "@/hooks/use-admin-overview";
import type { PlatformDashboardData } from "@/types";

/**
 * The headline figures.
 *
 * They sit on a plain ruled band rather than in four separate cards: four cards
 * make four objects out of one reading, and a reading is easier to compare when
 * the numbers share a baseline. Everything below the headline is an ordinary
 * label-and-figure row, because that is what the rest of administration uses to
 * say the same kind of thing.
 */
export function OverviewMetrics({
  activity,
  period,
}: {
  activity: AdminOverviewData | null;
  period: string;
}) {
  const { t } = useI18n();
  const headline = [
    [t("ui.adminConsole.registeredUsers"), activity?.totalUsers],
    [t("ui.adminConsole.active24h"), activity?.activeUsers24h],
    [t("ui.adminConsole.active7d"), activity?.activeUsers7d],
    [t("ui.adminConsole.active30d"), activity?.activeUsers30d],
  ] as const;
  const inPeriod = [
    [t("ui.adminConsole.newRegistrations"), activity?.newUsers],
    [t("ui.adminConsole.newIssues"), activity?.newIssues],
    [t("ui.adminConsole.newComments"), activity?.newComments],
    [t("ui.adminConsole.newFacilities"), activity?.newFacilities],
  ] as const;

  return (
    <div className="space-y-6">
      <div className="grid border-y sm:grid-cols-2 lg:grid-cols-4">
        {headline.map(([label, value], index) => (
          <div
            className={[
              "px-1 py-5 sm:px-5",
              index > 0 ? "sm:border-l" : "",
              index === 2 ? "sm:border-l-0 lg:border-l" : "",
            ].join(" ")}
            key={label}
          >
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
        <span className="text-xs text-muted-foreground">{period}</span>
      }>
        {inPeriod.map(([label, value]) => (
          <ListRow
            key={label}
            label={label}
            value={
              value === undefined ? (
                <Skeleton className="h-5 w-10" />
              ) : (
                <AnimatedNumber className="font-semibold tabular-nums" value={value} />
              )
            }
          />
        ))}
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
