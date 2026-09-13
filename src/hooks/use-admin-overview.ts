"use client";

import * as React from "react";

import { useI18n } from "@/i18n";
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
 * the window that changed.
 */
export function useAdminOverview(period: AdminOverviewWindow) {
  const session = useSession();
  const { t } = useI18n();
  const [activity, setActivity] = React.useState<AdminOverviewData | null>(null);
  const [platform, setPlatform] = React.useState<PlatformDashboardData | null>(() =>
    getViewMemory<PlatformDashboardData>(session.user?.uid, "dashboard"),
  );
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(
    async (forceRefresh = false) => {
      setLoading(true);
      setError("");
      try {
        const [nextActivity, nextPlatform] = await Promise.all([
          fetchAdminOverview(period),
          fetchPlatformDashboard({ forceRefresh }),
        ]);
        setActivity(nextActivity);
        setPlatform(nextPlatform);
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : t("ui.adminConsole.loadOverviewFailed"),
        );
      } finally {
        setLoading(false);
      }
    },
    [period, t],
  );

  React.useEffect(() => {
    void load();
  }, [load]);

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
