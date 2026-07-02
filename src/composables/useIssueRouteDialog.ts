import { computed, ref, watch, type Ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { normalizeIssueRouteFilterParam } from '@/constants/categories';
import { getDerivedIssueStatus } from '@/lib/issue-status';
import { normalizeRouteParam } from '@/lib/route';
import { useToast } from '@/composables/useToast';
import { fetchIssueRecordById } from '@/services/issues';
import type { IssueRecord } from '@/types';
import { isAbortFailure } from '@/lib/request';

export function useIssueRouteDialog(
  supportedIssueIds: Ref<Set<string>>,
  issues?: Ref<IssueRecord[]>,
) {
  const route = useRoute();
  const router = useRouter();
  const { showToast } = useToast();
  const routeIssue = ref<IssueRecord | null>(null);
  let requestId = 0;

  const routeIssueSupportClosed = computed(() => {
    if (!routeIssue.value) {
      return true;
    }
    return !routeIssue.value.support_enabled || getDerivedIssueStatus(routeIssue.value) !== 'pending';
  });

  function issueListRoute() {
    return {
      name: 'issues',
      params: { filter: normalizeIssueRouteFilterParam(route.params.filter) },
      hash: route.hash,
    };
  }

  function closeRouteIssue() {
    requestId += 1;
    routeIssue.value = null;
    router.replace(issueListRoute());
  }

  function prefillRouteIssue(issue: IssueRecord) {
    requestId += 1;
    routeIssue.value = {
      ...issue,
      currentUserSupported: supportedIssueIds.value.has(issue.id),
    };
  }

  function updateRouteIssueSupport(supported: boolean, supportCount?: number) {
    if (!routeIssue.value) return;
    const offset = supported ? 1 : -1;
    routeIssue.value = {
      ...routeIssue.value,
      currentUserSupported: supported,
      support_count: typeof supportCount === 'number'
        ? supportCount
        : Math.max(0, routeIssue.value.support_count + offset),
    };
  }

  function patchRouteIssue(issue: IssueRecord) {
    if (routeIssue.value?.id !== issue.id) return;
    routeIssue.value = {
      ...issue,
      currentUserSupported: supportedIssueIds.value.has(issue.id),
    };
  }

  async function handleRouteIssueError(currentRequestId: number) {
    if (currentRequestId !== requestId) return;
    routeIssue.value = null;
    showToast('此頁面已不存在或你沒有權限查看此頁面。', 'error');
    await router.replace(issueListRoute());
  }

  watch(
    () => [route.name, route.params.issueId, route.params.filter] as const,
    async ([routeName, rawIssueId]) => {
      const issueId = normalizeRouteParam(rawIssueId);
      if (routeName !== 'issue-detail' || !issueId) {
        requestId += 1;
        routeIssue.value = null;
        return;
      }

      if (routeIssue.value?.id !== issueId) {
        routeIssue.value = null;
      }

      if (issues && issues.value) {
        const listedIssue = issues.value.find((i) => i.id === issueId);
        if (listedIssue) {
          routeIssue.value = {
            ...listedIssue,
            currentUserSupported: supportedIssueIds.value.has(listedIssue.id),
          };
        }
      }

      const currentRequestId = ++requestId;
      try {
        const issue = await fetchIssueRecordById(issueId);
        if (currentRequestId !== requestId) return;
        routeIssue.value = {
          ...issue,
          currentUserSupported: supportedIssueIds.value.has(issue.id),
        };
      } catch (error) {
        if (isAbortFailure(error)) return;
        await handleRouteIssueError(currentRequestId);
      }
    },
    { immediate: true },
  );

  watch(supportedIssueIds, (ids) => {
    if (!routeIssue.value) return;
    routeIssue.value = {
      ...routeIssue.value,
      currentUserSupported: ids.has(routeIssue.value.id),
    };
  });

  return {
    routeIssue,
    routeIssueSupportClosed,
    closeRouteIssue,
    prefillRouteIssue,
    patchRouteIssue,
    updateRouteIssueSupport,
  };
}
