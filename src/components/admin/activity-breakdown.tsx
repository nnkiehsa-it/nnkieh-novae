"use client";

import { useI18n } from "@/i18n";
import { AdminActivityRows } from "@/components/admin/admin-activity-feed";
import { ListCustomRow, ListRow, ListSection } from "@/components/ui/list";
import type { AdminOverviewData } from "@/hooks/use-admin-overview";

/**
 * What one of the overview's period figures is made of.
 *
 * The figure opens onto its own share of the period's activity, out of the
 * reading the screen already holds, so asking what a number is made of costs
 * nothing. That reading has a ceiling, so it says when it is showing only the
 * most recent part of what the figure counts.
 */
export function ActivityBreakdown({
  count,
  entries,
  period,
}: {
  count: number | undefined;
  entries: AdminOverviewData["recentActivity"];
  /** The period the figure was read over, named as the group's header. */
  period: string;
}) {
  const { t } = useI18n();
  return (
    <ListSection header={period}>
      {entries.length > 0 ? (
        <AdminActivityRows entries={entries} showKind={false} />
      ) : (
        <ListRow label={t("ui.adminConsole.noRecentActivity")} />
      )}
      {count !== undefined && entries.length > 0 && entries.length < count ? (
        <ListCustomRow className="text-xs text-muted-foreground">
          {t("ui.adminConsole.activityShown", { shown: entries.length })}
        </ListCustomRow>
      ) : null}
    </ListSection>
  );
}
