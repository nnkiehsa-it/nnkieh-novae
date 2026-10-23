import * as React from "react";

import { useAdminReading } from "@/hooks/use-admin-reading";
import { useRememberedState } from "@/hooks/use-remembered-state";
import {
  fetchAdminOverview,
  type AdminOverviewData,
  type AdminOverviewWindow,
} from "@/services/admin-console";
import { failingWork, fetchPlatformDashboard, type PlatformDashboard } from "@/services/dashboard";

export type { AdminOverviewData } from "@/services/admin-console";
export type { PlatformDashboard } from "@/services/dashboard";

/**
 * One reading of the platform, for the one screen that reports on it.
 *
 * The activity figures and the operational figures used to be two screens, and
 * the admin one re-read the whole dashboard on every mount -- bypassing its own
 * short-lived cache -- only to add four counters together. Here the dashboard is
 * read once through that cache, and changing the reporting window re-reads only
 * the window that changed -- and only the first time that window is asked for,
 * because a window already read stays on screen until the reader refreshes it.
 */
export function useAdminOverview(period: AdminOverviewWindow) {
  const { cold, refresh, remember, value: activity } = useRememberedState<AdminOverviewData | null>(
    `admin-overview:${period}`,
    null,
  );
  const { remember: setPlatform, value: platform } = useRememberedState<PlatformDashboard | null>(
    "platform-dashboard",
    null,
  );
  const { error, loading, read } = useAdminReading(`admin-overview:${period}`, "ui.adminConsole.loadOverviewFailed");

  const load = React.useCallback(
    (forceRefresh = false) => read(
      () => Promise.all([
          fetchAdminOverview(period),
          fetchPlatformDashboard({ forceRefresh }),
      ]),
      ([nextActivity, nextPlatform]) => {
        remember(nextActivity);
        setPlatform(nextPlatform);
      },
    ),
    [period, read, remember, setPlatform],
  );

  const unread = cold || !platform;
  React.useEffect(() => {
    if (unread || refresh) void load(refresh);
  }, [load, unread, refresh]);

  const failing = platform ? failingWork(platform) : 0;

  return { activity, error, failing, load, loading, platform };
}
