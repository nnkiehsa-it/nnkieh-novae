import { computed, onScopeDispose, ref, watch, type Ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { returnToNavigationOrigin } from '@/router/navigation-hierarchy';
import { normalizeIssueRouteFilterParam } from '@/constants/categories';
import { getDerivedIssueStatus } from '@/lib/issue-status';
import { getIssueStatusBucket } from '@/lib/issue-timeline';
import { normalizeRouteParam } from '@/lib/route';
import { useActionFeedback } from '@/composables/useActionFeedback';
import { useIssueDetailCacheScope } from '@/composables/useIssueDetailCacheScope';
import { useSession } from '@/composables/useSession';
import { registerAppResumeHandler } from '@/composables/useAppResume';
import { useNetworkStatus } from '@/composables/useNetworkStatus';
import { fetchIssueRecordById } from '@/services/issues';
import { subscribeContentRealtimeEvents } from '@/services/realtime-events';
import type { IssueRecord } from '@/types';
import { isAbortFailure } from '@/lib/request';
import { takeIssueDetailPreview } from '@/lib/issue-detail-preview';
import { subscribeContentRevisionChanges } from '@/services/content-revisions';
import {
  createContentCacheKey,
  getCachedContentEntry,
  markContentRealtimeReliable,
  markContentRealtimeUnreliable,
  markContentWentOffline,
  patchCachedContent,
  shouldRefreshContentAfterResume,
} from '@/services/content-read-cache';

export function useIssueRouteDetail(
  supportedIssueIds: Ref<Set<string>>,
  issues?: Ref<IssueRecord[]>,
  enabled?: Ref<boolean>,
) {
  const route = useRoute();
  const router = useRouter();
  const { show } = useActionFeedback();
  const { roleLoading } = useSession();
  const { isOnline } = useNetworkStatus();
  const routeIssue = ref<IssueRecord | null>(null);
  const routeIssueLoading = ref(false);
  const routeIssuePreview = ref(false);
  let requestId = 0;
  let realtimeUnsubscribe: (() => void) | null = null;
  let realtimeRefreshTimer = 0;
  const detailCacheScope = useIssueDetailCacheScope();
  function detailCacheKey(issueId: string) {
    return createContentCacheKey(['issue-detail', issueId, detailCacheScope.value]);
  }
  const unregisterResumeHandler = registerAppResumeHandler(() => {
    const issueId = normalizeRouteParam(route.params.issueId);
    if (route.name !== 'issue-detail' || !issueId) return;
    const cached = getCachedContentEntry<IssueRecord>(detailCacheKey(issueId));
    if (!shouldRefreshContentAfterResume(cached?.updatedAt ?? 0)) return;
    void refreshRouteIssueSilently({ force: true });
  });
  const unsubscribeRevision = subscribeContentRevisionChanges('issues', () => {
    if (route.name === 'issue-detail') return refreshRouteIssueSilently({ force: true });
  });

  const routeIssueSupportClosed = computed(() => {
    if (!routeIssue.value) {
      return true;
    }
    return !routeIssue.value.support_enabled || getDerivedIssueStatus(routeIssue.value) !== 'pending';
  });

  function issueListRoute(issue?: IssueRecord | null) {
    const query = { ...route.query };
    delete query.tab;
    delete query.comment;
    if (issue && getIssueStatusBucket(issue) === 'closed') {
      query.status = 'closed';
    } else if (issue) {
      delete query.status;
    }
    return {
      name: 'issues',
      params: { filter: normalizeIssueRouteFilterParam(route.params.filter) },
      query,
      hash: route.hash,
    };
  }

  function issueWithSupportState(issue: IssueRecord) {
    return {
      ...issue,
      currentUserSupported: issue.currentUserSupported || supportedIssueIds.value.has(issue.id),
    };
  }

  function closeRouteIssue() {
    const currentIssue = routeIssue.value;
    requestId += 1;
    routeIssueLoading.value = false;
    routeIssuePreview.value = false;
    if (returnToNavigationOrigin(router)) return;
    router.replace(issueListRoute(currentIssue));
  }

  function prefillRouteIssue(issue: IssueRecord) {
    requestId += 1;
    routeIssue.value = issueWithSupportState(issue);
    routeIssueLoading.value = false;
    routeIssuePreview.value = false;
  }

  function updateRouteIssueSupport(supported: boolean, supportCount?: number) {
    if (!routeIssue.value) return;
    const issueId = routeIssue.value.id;
    const nextIds = new Set(supportedIssueIds.value);
    if (supported) {
      nextIds.add(routeIssue.value.id);
    } else {
      nextIds.delete(routeIssue.value.id);
    }
    supportedIssueIds.value = nextIds;

    const offset = supported ? 1 : -1;
    routeIssue.value = {
      ...routeIssue.value,
      currentUserSupported: supported,
      support_count: typeof supportCount === 'number'
        ? supportCount
        : Math.max(0, routeIssue.value.support_count + offset),
    };
    patchCachedContent<IssueRecord>(
      detailCacheKey(issueId),
      (issue) => ({
        ...issue,
        currentUserSupported: supported,
        support_count: typeof supportCount === 'number'
          ? supportCount
          : Math.max(0, issue.support_count + offset),
      }),
    );
  }

  function patchRouteIssue(issue: IssueRecord) {
    if (routeIssue.value?.id !== issue.id) return;
    routeIssue.value = issueWithSupportState(issue);
    routeIssuePreview.value = false;
  }

  async function handleRouteIssueError(currentRequestId: number) {
    if (currentRequestId !== requestId) return;
    routeIssue.value = null;
    routeIssueLoading.value = false;
    routeIssuePreview.value = false;
    show('issue.thisPageDoesNotExistOrCannotBeViewed', 'error');
    await router.replace(issueListRoute());
  }

  watch(
    () => [route.name, route.params.issueId, route.params.filter, enabled?.value ?? true] as const,
    async ([routeName, rawIssueId, _rawFilter, isEnabled]) => {
      if (!isEnabled) return;
      const issueId = normalizeRouteParam(rawIssueId);
      if (routeName !== 'issue-detail' || !issueId) {
        requestId += 1;
        routeIssue.value = null;
        routeIssueLoading.value = false;
        routeIssuePreview.value = false;
        return;
      }

      if (routeIssue.value?.id !== issueId) {
        routeIssue.value = null;
        routeIssuePreview.value = false;
      }

      const preview = takeIssueDetailPreview(issueId);
      if (preview) {
        routeIssue.value = issueWithSupportState(preview);
        routeIssuePreview.value = true;
      }

      if (issues && issues.value) {
        const listedIssue = issues.value.find((i) => i.id === issueId);
        if (listedIssue) {
          routeIssue.value = issueWithSupportState(listedIssue);
          routeIssuePreview.value = true;
        }
      }

      const currentRequestId = ++requestId;
      routeIssueLoading.value = true;
      try {
        const issue = await fetchIssueRecordById(issueId, { cacheScope: detailCacheScope.value });
        if (currentRequestId !== requestId) return;
        routeIssue.value = issueWithSupportState(issue);
        routeIssuePreview.value = false;
      } catch (error) {
        if (isAbortFailure(error)) return;
        await handleRouteIssueError(currentRequestId);
      } finally {
        if (currentRequestId === requestId) {
          routeIssueLoading.value = false;
        }
      }
    },
    { immediate: true },
  );

  async function refreshRouteIssueSilently(options: { force?: boolean } = {}) {
    const issueId = routeIssue.value?.id ?? normalizeRouteParam(route.params.issueId);
    if (!issueId) return;

    const currentRequestId = ++requestId;
    try {
      const issue = await fetchIssueRecordById(issueId, {
        cacheScope: detailCacheScope.value,
        forceRefresh: options.force === true,
      });
      if (currentRequestId !== requestId) return;
      routeIssue.value = issueWithSupportState(issue);
      routeIssuePreview.value = false;
      markContentRealtimeReliable();
    } catch (error) {
      if (isAbortFailure(error)) return;
      await handleRouteIssueError(currentRequestId);
    }
  }

  function scheduleRealtimeRefresh() {
    window.clearTimeout(realtimeRefreshTimer);
    realtimeRefreshTimer = window.setTimeout(() => {
      void refreshRouteIssueSilently({ force: true });
    }, 300);
  }

  watch(
    () => [route.name, route.params.issueId, enabled?.value ?? true, roleLoading.value] as const,
    ([routeName, rawIssueId, isEnabled, waitingForRole]) => {
      realtimeUnsubscribe?.();
      realtimeUnsubscribe = null;
      window.clearTimeout(realtimeRefreshTimer);
      const issueId = normalizeRouteParam(rawIssueId);
      if (!isEnabled || waitingForRole || routeName !== 'issue-detail' || !issueId) return;

      realtimeUnsubscribe = subscribeContentRealtimeEvents(`issue-detail:${issueId}`, (event) => {
        if (event.eventType === 'issue_support_changed' && event.targetId === issueId && event.supportCount !== null) {
          if (routeIssue.value) {
            routeIssue.value = { ...routeIssue.value, support_count: event.supportCount };
          }
          patchCachedContent<IssueRecord>(
            detailCacheKey(issueId),
            (issue) => ({ ...issue, support_count: event.supportCount ?? issue.support_count }),
          );
          return;
        }
        if (event.eventType !== 'issue_changed') return;
        if (event.targetId !== issueId) return;
        scheduleRealtimeRefresh();
      }, () => {
        markContentRealtimeUnreliable();
      }, scheduleRealtimeRefresh);
    },
    { immediate: true },
  );

  watch(supportedIssueIds, (ids) => {
    if (!routeIssue.value) return;
    routeIssue.value = {
      ...routeIssue.value,
      currentUserSupported: routeIssue.value.currentUserSupported || ids.has(routeIssue.value.id),
    };
  });

  onScopeDispose(() => {
    realtimeUnsubscribe?.();
    unregisterResumeHandler();
    unsubscribeRevision();
    window.clearTimeout(realtimeRefreshTimer);
  });

  watch(isOnline, (online) => {
    if (!online) {
      markContentWentOffline();
      return;
    }
    const issueId = normalizeRouteParam(route.params.issueId);
    if (route.name !== 'issue-detail' || !issueId) return;
    const cached = getCachedContentEntry<IssueRecord>(detailCacheKey(issueId));
    if (shouldRefreshContentAfterResume(cached?.updatedAt ?? 0)) {
      void refreshRouteIssueSilently({ force: true });
    }
  });

  return {
    routeIssue,
    routeIssueLoading,
    routeIssuePreview,
    routeIssueSupportClosed,
    closeRouteIssue,
    prefillRouteIssue,
    patchRouteIssue,
    updateRouteIssueSupport,
  };
}
