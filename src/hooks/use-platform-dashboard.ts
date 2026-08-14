"use client";

import * as React from "react";
import { useI18n } from "@/i18n";
import { useSession } from "@/hooks/use-session";
import { fetchPlatformDashboard } from "@/services/dashboard";
import type { PlatformDashboardData } from "@/types";
import { getViewMemory, setViewMemory } from "@/lib/view-memory-cache";
import { waitForMinimumSkeletonDuration } from "@/lib/loading-timing";

export function usePlatformDashboard() {
  const session = useSession();
  const { t } = useI18n();
  const viewMemory = getViewMemory<PlatformDashboardData>(
    session.user?.uid,
    "dashboard",
  );
  const [data, setData] = React.useState<PlatformDashboardData | null>(viewMemory);
  const [loading, setLoading] = React.useState(!viewMemory);
  const [error, setError] = React.useState("");
  const [revealFields] = React.useState(() => !viewMemory);
  const canView = session.can("dashboard.view");

  const load = React.useCallback(
    async (forceRefresh = false) => {
      if (!canView) return;
      const skeletonStartedAt = revealFields ? Date.now() : 0;
      setLoading(true);
      setError("");
      try {
        setData(await fetchPlatformDashboard({ forceRefresh }));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : t("ui.common.loadFailed"));
      } finally {
        if (skeletonStartedAt)
          await waitForMinimumSkeletonDuration(skeletonStartedAt);
        setLoading(false);
      }
    },
    [canView, revealFields, t],
  );

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (data) setViewMemory(session.user?.uid, "dashboard", data);
  }, [data, session.user?.uid]);

  return { canView, data, error, load, loading, revealFields };
}
