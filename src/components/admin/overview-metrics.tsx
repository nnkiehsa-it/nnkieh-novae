"use client";

import { useI18n } from "@/i18n";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { Skeleton } from "@/components/ui/skeleton";
import { getIssueCategoryLabel } from "@/constants/categories";
import type { AdminOverviewData } from "@/hooks/use-admin-overview";
import type { PlatformDashboardData } from "@/types";

/**
 * The headline figures.
 *
 * They sit on a plain ruled band rather than in four separate cards: four cards
 * make four objects out of one reading, and a reading is easier to compare when
 * the numbers share a baseline.
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

      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
          <h2 className="text-xs font-medium uppercase tracking-[0.04em] text-muted-foreground">
            {t("ui.adminConsole.period")}
          </h2>
          <span className="text-xs text-muted-foreground">{period}</span>
        </div>
        <div className="rule-card grid gap-x-6 py-1 sm:grid-cols-2">
          {inPeriod.map(([label, value]) => (
            <div className="flex min-h-[3.25rem] items-center gap-3" key={label}>
              <span className="min-w-0 flex-1 text-[0.9375rem]">{label}</span>
              {value === undefined ? (
                <Skeleton className="h-6 w-10" />
              ) : (
                <AnimatedNumber className="text-lg font-semibold tabular-nums" value={value} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Where the issues actually are, as a share of the whole. */
export function OverviewDistribution({ platform }: { platform: PlatformDashboardData | null }) {
  const { t } = useI18n();
  const byCategory = platform?.stats.issues_by_category;
  const entries = Object.entries(byCategory ?? {}).toSorted((left, right) => right[1] - left[1]);
  const largest = Math.max(1, ...entries.map(([, count]) => count));

  return (
    <div>
      <h2 className="mb-2 px-1 text-xs font-medium uppercase tracking-[0.04em] text-muted-foreground">
        {t("ui.dashboard.categoryDistribution")}
      </h2>
      <div className="rule-card py-4">
        {!byCategory ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-4/5" />
            <Skeleton className="h-8 w-3/5" />
          </div>
        ) : (
          entries.map(([category, count], index) => (
            <div className="py-2" key={category}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{getIssueCategoryLabel(category)}</span>
                <AnimatedNumber className="font-medium tabular-nums" value={count} />
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full origin-left rounded-full bg-foreground animate-[dashboard-bar_var(--motion-sheet)_var(--ease-arrive)_both]"
                  style={
                    {
                      "--dashboard-bar": count / largest,
                      animationDelay: `${index * 40}ms`,
                    } as React.CSSProperties
                  }
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
