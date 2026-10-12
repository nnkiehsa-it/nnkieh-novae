"use client";

import * as React from "react";
import { ADMIN_OVERVIEW_WINDOWS, type AdminOverviewWindow } from "@/constants/admin-activity";
import { useAdminActivity } from "@/hooks/use-admin-console";
import { useI18n } from "@/i18n";
import { Button } from "@/ui/button";
import { ListGroup, ListRow } from "@/ui/list";
import { Segmented } from "@/ui/segmented";
import { LoadError } from "../shared/feedback";
import { ActivityRows } from "../shared/activity-rows";

/** What the platform itself recorded over a chosen period, a page at a time. */
export function ActivityFeed() {
  const { t } = useI18n();
  const [period, setPeriod] = React.useState<AdminOverviewWindow>("24h");
  const activity = useAdminActivity(period);

  return (
    <div className="grid gap-6">
      <Segmented
        className="justify-self-start"
        label={t("ui.adminConsole.period")}
        onChange={setPeriod}
        options={ADMIN_OVERVIEW_WINDOWS.map((entry) => ({ label: t(entry.labelKey), value: entry.value }))}
        value={period}
      />
      {activity.entries.length > 0 || !activity.error ? (
        <ListGroup label={t("ui.adminConsole.period")}>
          {activity.entries.length > 0
            ? <ActivityRows entries={activity.entries} />
            : <ListRow label={t(activity.loading ? "ui.common.loadingMore" : "ui.adminConsole.noRecentActivity")} />}
        </ListGroup>
      ) : null}
      {activity.error ? <LoadError message={activity.error} onRetry={() => void activity.load(activity.cursor)} /> : null}
      {activity.cursor && !activity.error ? (
        <Button className="justify-self-center" onClick={() => void activity.load(activity.cursor)} status={activity.loading ? "loading" : "idle"}>
          {t("ui.common.loadMore")}
        </Button>
      ) : null}
    </div>
  );
}
