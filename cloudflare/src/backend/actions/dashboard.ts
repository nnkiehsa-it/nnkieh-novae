import type { ActionInput } from "../../../../shared/actions.ts";
import type { AuthContext, BackendDatabase } from "./types.ts";

interface DashboardSnapshot {
  issues_by_category: Record<string, number>;
  delivery_failed: number;
  delivery_pending: number;
  notion_pending: number;
  push_failed: number;
  upload_pending: number;
  deletion_pending: number;
  deletion_failed: number;
  recent_failures: Array<{ id: string; source: string; status: string; failure_id: string; updated_at: string }>;
}

/** Whether the platform is keeping up: what is waiting, what failed, and the latest failures. */
export async function getPlatformDashboard(_input: ActionInput<"getPlatformDashboard">, _auth: AuthContext, database: BackendDatabase) {
  const snapshot = await database.call("app_api", "get_platform_dashboard_snapshot") as unknown as DashboardSnapshot;
  const failing = snapshot.delivery_failed > 0 || snapshot.push_failed > 0 || snapshot.deletion_failed > 0;
  const waiting = snapshot.delivery_pending > 0 || snapshot.deletion_pending > 0 || snapshot.upload_pending > 0;
  return {
    status: failing ? "critical" : waiting ? "attention" : "healthy",
    issuesByCategory: snapshot.issues_by_category,
    pendingNotionSync: snapshot.notion_pending,
    failedDeliveries: snapshot.delivery_failed,
    failedPushDeliveries: snapshot.push_failed,
    cleanupBacklog: snapshot.deletion_pending,
    stuckUploads: snapshot.upload_pending,
    recentFailures: snapshot.recent_failures.map((failure) => ({
      id: failure.id,
      source: failure.source,
      status: failure.status,
      // The snapshot spells a missing attempt as an empty string.
      failureId: failure.failure_id || null,
      updatedAt: failure.updated_at,
    })),
  };
}
