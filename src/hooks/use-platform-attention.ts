import * as React from "react";
import { useSession } from "@/hooks/use-session";
import { failingWork, fetchPlatformDashboard } from "@/services/dashboard";

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
      .then((dashboard) => {
        if (current) setFailing(failingWork(dashboard));
      })
      .catch(() => undefined);
    return () => { current = false; };
  }, [allowed]);

  return { allowed, failing: allowed ? failing : null };
}
