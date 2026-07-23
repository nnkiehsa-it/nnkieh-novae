import { invokeBackendAction } from '@/services/backend-action';
import { toReadableBackendError } from '@/services/issues-core';
import type { PlatformDashboardData, PlatformDashboardOperations, PlatformDashboardStats } from '@/types';
import { getRouteRequestSignal } from '@/lib/route-request';
import { READ_REQUEST_TIMEOUT_MS } from '@/lib/request';
import {
  CONTENT_SHORT_CACHE_TTL_MS,
  getCachedContentPersistent,
  runCoalescedContentRequest,
  setCachedContentFromRead,
} from '@/services/content-read-cache';

interface DashboardResponse {
  stats: Omit<PlatformDashboardStats, 'last_activity_at' | 'updated_at'> & {
    last_activity_at_ms: number | null;
    updated_at_ms: number | null;
  };
  operations: Omit<
    PlatformDashboardOperations,
    'oldest_pending_sync_at' | 'scheduled_maintenance' | 'recent_failures'
  > & {
    oldest_pending_sync_at_ms: number | null;
    scheduled_maintenance: {
      status: string;
      started_at_ms: number | null;
      completed_at_ms: number | null;
      updated_at_ms: number | null;
      failed_task_codes: string[];
      error_trace_id: string;
    };
    recent_failures: Array<{
      id: string;
      attempt_count: number;
      created_at_ms: number | null;
      detail_type: string;
      source: string;
      status: string;
      error_trace_id: string;
      next_attempt_at_ms: number | null;
      target_id: string;
      target_type: string;
      updated_at_ms: number | null;
    }>;
  };
}

const DASHBOARD_CACHE_KEY = 'platform-dashboard';

function toDate(value: number | null) {
  return typeof value === 'number' ? new Date(value) : null;
}

export async function fetchPlatformDashboard(options: { forceRefresh?: boolean } = {}): Promise<PlatformDashboardData> {
  if (!options.forceRefresh) {
    const cached = await getCachedContentPersistent<PlatformDashboardData>(
      DASHBOARD_CACHE_KEY,
      CONTENT_SHORT_CACHE_TTL_MS,
    );
    if (cached) return cached;
  }
  return runCoalescedContentRequest(DASHBOARD_CACHE_KEY, async (cacheGuard) => {
    const data = await loadPlatformDashboard();
    setCachedContentFromRead(cacheGuard, data);
    return data;
  });
}

async function loadPlatformDashboard(): Promise<PlatformDashboardData> {
  try {
    const fn = invokeBackendAction<Record<string, never>, DashboardResponse>('getPlatformDashboard', {
      signal: getRouteRequestSignal(),
      timeoutMs: READ_REQUEST_TIMEOUT_MS,
    });
    const result = await fn({});
    const stats = result.stats;

    const operations = result.operations;

    return {
      stats: {
        total_users_seen: stats.total_users_seen,
        total_issues_created: stats.total_issues_created,
        total_comments_created: stats.total_comments_created,
        total_supports_added: stats.total_supports_added,
        total_supports_removed: stats.total_supports_removed,
        total_issues_deleted: stats.total_issues_deleted,
        total_comments_deleted: stats.total_comments_deleted,
        issues_by_category: stats.issues_by_category,
        comments_by_category: stats.comments_by_category,
        last_activity_at: toDate(stats.last_activity_at_ms),
        updated_at: toDate(stats.updated_at_ms),
      },
      operations: {
        overall_status: operations.overall_status,
        pending_notion_sync_count: operations.pending_notion_sync_count,
        pending_notion_sync_capped: operations.pending_notion_sync_capped,
        next_sync_count: operations.next_sync_count,
        failed_notion_sync_count: operations.failed_notion_sync_count,
        failed_notion_sync_capped: operations.failed_notion_sync_capped,
        oldest_pending_sync_at: toDate(operations.oldest_pending_sync_at_ms),
        failed_outbox_count: operations.failed_outbox_count,
        failed_outbox_capped: operations.failed_outbox_capped,
        failed_push_delivery_count: operations.failed_push_delivery_count,
        failed_push_delivery_capped: operations.failed_push_delivery_capped,
        stuck_upload_count: operations.stuck_upload_count,
        stuck_upload_capped: operations.stuck_upload_capped,
        cleanup_backlog_count: operations.cleanup_backlog_count,
        cleanup_backlog_capped: operations.cleanup_backlog_capped,
        scheduled_maintenance: {
          status: operations.scheduled_maintenance.status,
          started_at: toDate(operations.scheduled_maintenance.started_at_ms),
          completed_at: toDate(operations.scheduled_maintenance.completed_at_ms),
          updated_at: toDate(operations.scheduled_maintenance.updated_at_ms),
          failed_task_codes: operations.scheduled_maintenance.failed_task_codes,
          error_trace_id: operations.scheduled_maintenance.error_trace_id,
        },
        recent_failures: operations.recent_failures.map((failure) => ({
          id: failure.id,
          attempt_count: failure.attempt_count,
          created_at: toDate(failure.created_at_ms),
          detail_type: failure.detail_type,
          source: failure.source,
          status: failure.status,
          error_trace_id: failure.error_trace_id,
          next_attempt_at: toDate(failure.next_attempt_at_ms),
          target_id: failure.target_id,
          target_type: failure.target_type,
          updated_at: toDate(failure.updated_at_ms),
        })),
      },
    };
  } catch (error) {
    throw toReadableBackendError(error);
  }
}
