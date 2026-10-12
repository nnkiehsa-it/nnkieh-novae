"use client";

import type { AdminOverviewData } from "@/hooks/use-admin-overview";
import { useI18n } from "@/i18n";
import { ListGroup, ListRow } from "@/ui/list";
import { ActivityRows } from "../shared/activity-rows";

/**
 * What one of the period's counts is made of, out of the reading the screen
 * already holds. That reading has a ceiling, so it says when it shows only the
 * most recent part of what the count covers.
 */
export function ActivityBreakdown({ count, entries, period }: {
  count: number;
  entries: AdminOverviewData["recentActivity"];
  /** The period the count was read over, named as the group's title. */
  period: string;
}) {
  const { t } = useI18n();
  const truncated = entries.length > 0 && entries.length < count;
  return (
    <ListGroup footer={truncated ? t("ui.adminConsole.activityShown", { shown: entries.length }) : undefined} title={period}>
      {entries.length > 0
        ? <ActivityRows entries={entries} showKind={false} />
        : <ListRow label={t("ui.adminConsole.noRecentActivity")} />}
    </ListGroup>
  );
}
