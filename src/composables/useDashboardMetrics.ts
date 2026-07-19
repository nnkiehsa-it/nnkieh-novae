import { computed, type Ref } from 'vue';
import { getIssueCategorySnapshot } from '@/composables/useCategories';
import { formatDate } from '@/lib/format';
import type { PlatformDashboardOperations, PlatformDashboardStats } from '@/types';
import { useI18n } from '@/i18n';

export function useDashboardMetrics(
  stats: Ref<PlatformDashboardStats | null>,
  operations: Ref<PlatformDashboardOperations | null>,
) {
  const { t } = useI18n();
  const updatedLabel = computed(() => formatDate(stats.value?.updated_at ?? stats.value?.last_activity_at ?? null) || t('dashboard.notUpdatedYet'));

  const heroStats = computed(() => {
    if (!stats.value) return [];

    return [
      { label: t('dashboard.usedThePlatform'), value: stats.value.total_users_seen, caption: t('dashboard.people') },
      { label: t('dashboard.cumulativeProposals'), value: stats.value.total_issues_created, caption: t('dashboard.pen') },
      { label: t('dashboard.totalComments'), value: stats.value.total_comments_created, caption: t('dashboard.but') },
      { label: t('dashboard.totalSupport'), value: stats.value.total_supports_added, caption: t('dashboard.times') },
    ];
  });

  const categoryComparisonRows = computed(() => buildCategoryComparisonRows(stats.value, t));

  const operationsStatus = computed(() => statusView(operations.value?.overall_status ?? 'healthy', t));

  const operationSummaryCards = computed(() => {
    if (!operations.value) return [];
    return [
      {
        label: t('dashboard.systemStatus'),
        value: operationsStatus.value.label,
        caption: operationsStatus.value.caption,
        toneClass: operationsStatus.value.toneClass,
      },
      {
        label: t('dashboard.toBeSynchronized'),
        value: formatCappedCount(operations.value.pending_notion_sync_count, operations.value.pending_notion_sync_capped),
        caption: operations.value.oldest_pending_sync_at
          ? t('dashboard.theEarliestTime', { time: formatDate(operations.value.oldest_pending_sync_at) })
          : t('dashboard.thereAreCurrentlyNoPendingProjects'),
        toneClass: operations.value.pending_notion_sync_count > 0
          ? 'bg-warning-container text-on-warning-container'
          : 'bg-success-container text-on-success-container',
      },
      {
        label: t('dashboard.synchronizationException'),
        value: formatCappedCount(operations.value.failed_notion_sync_count, operations.value.failed_notion_sync_capped),
        caption: operations.value.next_sync_count > 0
          ? t('dashboard.countItemsInTheNextRound', { count: operations.value.next_sync_count })
          : t('dashboard.noNextRoundOfAggregationProjects'),
        toneClass: operations.value.failed_notion_sync_count > 0
          ? 'bg-error-container text-on-error-container'
          : 'bg-surface text-ink-900 dark:bg-surface dark:text-ink-100',
      },
      {
        label: t('dashboard.recentActivities'),
        value: updatedLabel.value,
        caption: t('dashboard.latestActivityTime'),
        toneClass: 'bg-surface text-ink-900 dark:bg-surface dark:text-ink-100',
      },
    ];
  });

  const operationRows = computed(() => {
    if (!operations.value) return [];
    const maintenance = operations.value.scheduled_maintenance;
    return [
      {
        label: 'dashboard.notionSync',
        value: t('dashboard.countToBeSynchronized', { count: formatCappedCount(operations.value.pending_notion_sync_count, operations.value.pending_notion_sync_capped) }),
        detail: operations.value.oldest_pending_sync_at
          ? t('dashboard.theEarliestWaitingTime', { time: formatDate(operations.value.oldest_pending_sync_at) })
          : t('dashboard.noPendingSyncJobs'),
        statusLabel: t(operations.value.failed_notion_sync_count > 0 ? 'dashboard.issue' : operations.value.pending_notion_sync_count > 0 ? 'dashboard.queuing' : 'dashboard.normal'),
        toneClass: operations.value.failed_notion_sync_count > 0 ? 'text-error' : operations.value.pending_notion_sync_count > 0 ? 'text-warning' : 'text-success',
      },
      {
        label: t('dashboard.notificationsAndSync'),
        value: t('dashboard.countFailed', { count: formatCappedCount(operations.value.failed_outbox_count, operations.value.failed_outbox_capped) }),
        detail: t('dashboard.notificationsSynchronizationAndCleanupResults'),
        statusLabel: t(operations.value.failed_outbox_count > 0 ? 'dashboard.needProcessing' : 'dashboard.normal'),
        toneClass: operations.value.failed_outbox_count > 0 ? 'text-error' : 'text-success',
      },
      {
        label: t('dashboard.pushNotification'),
        value: t('dashboard.countException', { count: formatCappedCount(operations.value.failed_push_delivery_count, operations.value.failed_push_delivery_capped) }),
        detail: t('dashboard.summaryOfBackgroundPushDistributionResults'),
        statusLabel: t(operations.value.failed_push_delivery_count > 0 ? 'dashboard.needToView' : 'dashboard.normal'),
        toneClass: operations.value.failed_push_delivery_count > 0 ? 'text-error' : 'text-success',
      },
      {
        label: t('dashboard.imageUpload'),
        value: t('dashboard.countStuck', { count: formatCappedCount(operations.value.stuck_upload_count, operations.value.stuck_upload_capped) }),
        detail: t('dashboard.stuckImageProcessing'),
        statusLabel: t(operations.value.stuck_upload_count > 0 ? 'dashboard.needCleaning' : 'dashboard.normal'),
        toneClass: operations.value.stuck_upload_count > 0 ? 'text-warning' : 'text-success',
      },
      {
        label: t('dashboard.deletionCleanup'),
        value: t('dashboard.countToBeCleared', { count: formatCappedCount(operations.value.cleanup_backlog_count, operations.value.cleanup_backlog_capped) }),
        detail: t('dashboard.externalCleanup'),
        statusLabel: t(operations.value.cleanup_backlog_count > 0 ? 'dashboard.toBeMaintained' : 'dashboard.normal'),
        toneClass: operations.value.cleanup_backlog_count > 0 ? 'text-warning' : 'text-success',
      },
      {
        label: t('dashboard.maintenanceSchedule'),
        value: maintenanceStatusLabel(maintenance.status, t),
        detail: maintenance.completed_at
          ? t('dashboard.lastCompletedTime', { time: formatDate(maintenance.completed_at) })
          : maintenance.updated_at
            ? t('dashboard.lastUpdatedTime', { time: formatDate(maintenance.updated_at) })
            : t('dashboard.noScheduleRecordYet'),
        statusLabel: maintenance.failed_task_codes.length > 0
          ? maintenance.failed_task_codes.map((code) => maintenanceTaskLabel(code, t)).join(', ')
          : maintenanceStatusLabel(maintenance.status, t),
        toneClass: maintenance.status === 'failed'
          ? 'text-error'
          : maintenance.status === 'running' || maintenance.status === 'attention'
            ? 'text-warning'
            : 'text-success',
      },
    ];
  });

  const recentFailureRows = computed(() => {
    if (!operations.value) return [];
    return operations.value.recent_failures.map((failure) => ({
      ...failure,
      sourceLabel: failure.source === 'notion'
        ? 'Notion'
        : failure.source === 'outbox'
          ? 'Outbox'
          : failure.source === 'push'
            ? t('dashboard.push')
            : failure.source === 'cleanup'
              ? t('dashboard.cleanup')
              : failure.source,
      updatedLabel: formatDate(failure.updated_at) || t('dashboard.timeUnknown'),
      trackingCode: failure.error_trace_id || failure.id,
    }));
  });

  return {
    updatedLabel,
    heroStats,
    categoryComparisonRows,
    operationsStatus,
    operationSummaryCards,
    operationRows,
    recentFailureRows,
  };
}

function formatCappedCount(count: number, capped: boolean) {
  return capped ? `${count}+` : String(count);
}

type Translate = (source: string, params?: Record<string, string | number>) => string;

function statusView(status: PlatformDashboardOperations['overall_status'], t: Translate) {
  switch (status) {
    case 'critical':
      return {
        label: t('dashboard.needProcessing'),
        caption: t('dashboard.failuresNeedReview'),
        toneClass: 'bg-error-container text-on-error-container',
      };
    case 'attention':
      return {
        label: t('dashboard.notice'),
        caption: t('dashboard.thereAreItemsQueuedOrToBeCleared'),
        toneClass: 'bg-warning-container text-on-warning-container',
      };
    case 'healthy':
      return {
        label: t('dashboard.normal'),
        caption: t('dashboard.quickScanFoundNoIssues'),
        toneClass: 'bg-success-container text-on-success-container',
      };
  }
}

function maintenanceStatusLabel(status: string, t: Translate) {
  if (status === 'success') return t('dashboard.normal');
  if (status === 'running') return t('dashboard.executing');
  if (status === 'attention') return t('dashboard.notice');
  if (status === 'failed') return t('dashboard.fail');
  return t('dashboard.noRecordYet');
}

function maintenanceTaskLabel(code: string, t: Translate) {
  if (code === 'maintenance.deletion-jobs-stale') return t('dashboard.deletionJobsStale');
  return t('dashboard.unknownMaintenanceFailure');
}

function buildCategoryComparisonRows(stats: PlatformDashboardStats | null, t: Translate) {
  if (!stats) return [];

  const total = Math.max(1, stats.total_issues_created + stats.total_comments_created);
  const barClasses = [
    'bg-success',
    'bg-processing',
    'bg-ink-700 dark:bg-ink-100',
  ];

  return getIssueCategorySnapshot().map(({ id: category, label }, index) => {
    const issues = stats.issues_by_category[category] ?? 0;
    const comments = stats.comments_by_category[category] ?? 0;
    const value = issues + comments;
    const exactPercent = Math.round((value / total) * 100);

    return {
      label,
      issues,
      comments,
      percent: value === 0 ? 0 : Math.max(8, exactPercent),
      percentLabel: `${exactPercent}%`,
      barClass: barClasses[index] ?? barClasses[0],
    };
  });
}
