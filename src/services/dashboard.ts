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
  stats: {
    totalUsersSeen: number;
    totalIssuesCreated: number;
    totalCommentsCreated: number;
    totalSupportsAdded: number;
    totalSupportsRemoved: number;
    totalIssuesDeleted: number;
    totalCommentsDeleted: number;
    issuesByCategory: PlatformDashboardStats['issues_by_category'];
    commentsByCategory: PlatformDashboardStats['comments_by_category'];
    lastActivityAt: string | null;
    updatedAt: string | null;
  };
  operations: {
    overallStatus: PlatformDashboardOperations['overall_status'];
    pendingNotionSyncCount: number;
    pendingNotionSyncCapped: boolean;
    nextSyncCount: number;
    failedNotionSyncCount: number;
    failedNotionSyncCapped: boolean;
    oldestPendingSyncAt: string | null;
    failedDeliveryCount: number;
    failedDeliveryCapped: boolean;
    failedPushDeliveryCount: number;
    failedPushDeliveryCapped: boolean;
    stuckUploadCount: number;
    stuckUploadCapped: boolean;
    cleanupBacklogCount: number;
    cleanupBacklogCapped: boolean;
    scheduledMaintenance: {
      status: string;
      startedAt: string | null;
      completedAt: string | null;
      updatedAt: string | null;
      failedTaskCodes: string[];
      failureId: string;
    };
    recentFailures: Array<{
      id: string;
      attemptCount: number;
      createdAt: string | null;
      detailType: string;
      source: string;
      status: string;
      failureId: string;
      nextAttemptAt: string | null;
      targetId: string;
      targetType: string;
      updatedAt: string | null;
    }>;
  };
}

const DASHBOARD_CACHE_KEY = 'platform-dashboard';

function toDate(value: string | null) {
  return typeof value === 'string' ? new Date(value) : null;
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
        total_users_seen: stats.totalUsersSeen,
        total_issues_created: stats.totalIssuesCreated,
        total_comments_created: stats.totalCommentsCreated,
        total_supports_added: stats.totalSupportsAdded,
        total_supports_removed: stats.totalSupportsRemoved,
        total_issues_deleted: stats.totalIssuesDeleted,
        total_comments_deleted: stats.totalCommentsDeleted,
        issues_by_category: stats.issuesByCategory,
        comments_by_category: stats.commentsByCategory,
        last_activity_at: toDate(stats.lastActivityAt),
        updated_at: toDate(stats.updatedAt),
      },
      operations: {
        overall_status: operations.overallStatus,
        pending_notion_sync_count: operations.pendingNotionSyncCount,
        pending_notion_sync_capped: operations.pendingNotionSyncCapped,
        next_sync_count: operations.nextSyncCount,
        failed_notion_sync_count: operations.failedNotionSyncCount,
        failed_notion_sync_capped: operations.failedNotionSyncCapped,
        oldest_pending_sync_at: toDate(operations.oldestPendingSyncAt),
        failed_delivery_count: operations.failedDeliveryCount,
        failed_delivery_capped: operations.failedDeliveryCapped,
        failed_push_delivery_count: operations.failedPushDeliveryCount,
        failed_push_delivery_capped: operations.failedPushDeliveryCapped,
        stuck_upload_count: operations.stuckUploadCount,
        stuck_upload_capped: operations.stuckUploadCapped,
        cleanup_backlog_count: operations.cleanupBacklogCount,
        cleanup_backlog_capped: operations.cleanupBacklogCapped,
        scheduled_maintenance: {
          status: operations.scheduledMaintenance.status,
          started_at: toDate(operations.scheduledMaintenance.startedAt),
          completed_at: toDate(operations.scheduledMaintenance.completedAt),
          updated_at: toDate(operations.scheduledMaintenance.updatedAt),
          failed_task_codes: operations.scheduledMaintenance.failedTaskCodes,
          failure_id: operations.scheduledMaintenance.failureId,
        },
        recent_failures: operations.recentFailures.map((failure) => ({
          id: failure.id,
          attempt_count: failure.attemptCount,
          created_at: toDate(failure.createdAt),
          detail_type: failure.detailType,
          source: failure.source,
          status: failure.status,
          failure_id: failure.failureId,
          next_attempt_at: toDate(failure.nextAttemptAt),
          target_id: failure.targetId,
          target_type: failure.targetType,
          updated_at: toDate(failure.updatedAt),
        })),
      },
    };
  } catch (error) {
    throw toReadableBackendError(error);
  }
}
