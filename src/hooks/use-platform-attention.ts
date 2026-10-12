"use client";

import * as React from "react";
import { useSession } from "@/hooks/use-session";
import { fetchPlatformDashboard } from "@/services/dashboard";

/**
 * How many background jobs are failing or stuck, for the people who can see
 * the operations screen. Everyone else never asks.
 */
export function usePlatformAttention() {
  const session = useSession();
  const allowed = session.can("dashboard.view");
  const [failing, setFailing] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!allowed) return;
    let current = true;
    fetchPlatformDashboard()
      .then(({ operations }) => {
        if (current) {
          setFailing(operations.failed_delivery_count + operations.failed_push_delivery_count
            + operations.cleanup_backlog_count + operations.stuck_upload_count);
        }
      })
      .catch(() => undefined);
    return () => { current = false; };
  }, [allowed]);

  return { allowed, failing: allowed ? failing : null };
}
