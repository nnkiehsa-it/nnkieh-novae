"use client";

import * as React from "react";

import { useAdminReading } from "@/hooks/use-admin-reading";
import { useRememberedState } from "@/hooks/use-remembered-state";
import { useSession } from "@/hooks/use-session";
import {
  fetchAdminOverview,
  type AdminOverviewData,
  type AdminOverviewWindow,
} from "@/services/admin-console";
import { fetchPlatformDashboard } from "@/services/dashboard";
import { getViewMemory, setViewMemory } from "@/lib/view-memory-cache";
import type { PlatformDashboardData } from "@/types";

export type { AdminOverviewData, AdminOverviewWindow } from "@/services/admin-console";

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
  const session = useSession();
  const { cold, refresh, remember, value: activity } = useRememberedState<AdminOverviewData | null>(
    `admin-overview:${period}`,
    null,
  );
  const [platform, setPlatform] = React.useState<PlatformDashboardData | null>(() =>
    getViewMemory<PlatformDashboardData>(session.user?.uid, "dashboard"),
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
    [period, read, remember],
  );

  const unread = cold || !platform;
  React.useEffect(() => {
    if (unread || refresh) void load(refresh);
  }, [load, unread, refresh]);

  React.useEffect(() => {
    if (platform) setViewMemory(session.user?.uid, "dashboard", platform);
  }, [platform, session.user?.uid]);

  const failing = platform
    ? platform.operations.failed_delivery_count
      + platform.operations.failed_push_delivery_count
      + platform.operations.cleanup_backlog_count
      + platform.operations.stuck_upload_count
    : 0;

  return { activity, error, failing, load, loading, platform };
}
