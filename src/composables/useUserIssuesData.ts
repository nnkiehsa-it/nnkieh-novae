import { computed, reactive, watch, type Ref } from 'vue';
import { fetchUserIssues } from '@/services/issues';
import { waitForMinimumDuration } from '@/lib/page-size';
import type { IssueFilter, IssueRecord, IssueSortOption } from '@/types';

type IssueBoardFilter = IssueFilter | 'my-proposals';

export function useUserIssuesData(
  activeFilter: Ref<IssueBoardFilter>,
  userUid: Ref<string>,
  isAllowedUser: Ref<boolean>,
  supportedIssueIds: Ref<Set<string>>,
  sortOption: Ref<IssueSortOption>,
  pageSize: Ref<number>,
) {
  const userIssuesState = reactive({
    allIssues: [] as IssueRecord[],
    error: '',
    loadedCount: pageSize.value,
    loading: false,
    loadingMore: false,
    refreshing: false,
  });

  let requestToken = 0;

  const sortedIssues = computed(() => {
    const nextIssues = [...userIssuesState.allIssues];
    if (sortOption.value === 'most-supported') {
      return nextIssues.sort((left, right) =>
        right.support_count - left.support_count
        || (right.created_at?.getTime() ?? 0) - (left.created_at?.getTime() ?? 0)
      );
    }
    if (sortOption.value === 'ending-soon') {
      return nextIssues.sort((left, right) =>
        (left.support_deadline_at?.getTime() ?? Number.POSITIVE_INFINITY)
        - (right.support_deadline_at?.getTime() ?? Number.POSITIVE_INFINITY)
        || (right.created_at?.getTime() ?? 0) - (left.created_at?.getTime() ?? 0)
      );
    }
    return nextIssues;
  });
  const visibleIssues = computed(() => sortedIssues.value.slice(0, userIssuesState.loadedCount));
  const hasMore = computed(() => userIssuesState.loadedCount < sortedIssues.value.length);

  function addUserIssue(issue: IssueRecord) {
    const issueMap = new Map(userIssuesState.allIssues.map((entry) => [entry.id, entry]));
    issueMap.set(issue.id, {
      ...issue,
      currentUserSupported: supportedIssueIds.value.has(issue.id),
    });
    userIssuesState.allIssues = Array.from(issueMap.values());
  }

  function removeUserIssue(issueId: string) {
    userIssuesState.allIssues = userIssuesState.allIssues.filter((issue) => issue.id !== issueId);
  }

  function stopUserIssuesRequest() {
    requestToken += 1;
    userIssuesState.loading = false;
    userIssuesState.loadingMore = false;
    userIssuesState.refreshing = false;
  }

  function resetUserIssues() {
    stopUserIssuesRequest();
    userIssuesState.allIssues = [];
    userIssuesState.error = '';
    userIssuesState.loadedCount = pageSize.value;
  }

  function bumpUserIssuesRequestToken() {
    requestToken += 1;
  }

  async function loadCurrentUserIssues(options: { silent?: boolean } = {}) {
    const uid = userUid.value;
    if (activeFilter.value !== 'my-proposals' || !isAllowedUser.value || !uid) {
      userIssuesState.loading = false;
      return;
    }

    const currentToken = ++requestToken;
    userIssuesState.error = '';
    userIssuesState.loadedCount = pageSize.value;
    if (options.silent && userIssuesState.allIssues.length > 0) {
      userIssuesState.refreshing = true;
    } else {
      userIssuesState.loading = true;
    }

    try {
      const issues = await fetchUserIssues(uid, { supportedIssueIds: supportedIssueIds.value });
      if (currentToken !== requestToken) return;
      userIssuesState.allIssues = issues;
      userIssuesState.error = '';
    } catch {
      if (currentToken === requestToken && userIssuesState.allIssues.length === 0) {
        userIssuesState.error = '提案載入失敗，請稍後再試。';
      }
    } finally {
      if (currentToken === requestToken) {
        userIssuesState.loading = false;
        userIssuesState.refreshing = false;
      }
    }
  }

  async function loadMoreUserIssues() {
    if (!hasMore.value || userIssuesState.loadingMore) return;
    const startedAt = Date.now();
    userIssuesState.loadingMore = true;
    await waitForMinimumDuration(startedAt, 200);
    userIssuesState.loadedCount += pageSize.value;
    userIssuesState.loadingMore = false;
  }

  watch([activeFilter, userUid, isAllowedUser], () => {
    void loadCurrentUserIssues();
  }, { immediate: true });

  watch(supportedIssueIds, (newIds) => {
    userIssuesState.allIssues = userIssuesState.allIssues.map((issue) => ({
      ...issue,
      currentUserSupported: newIds.has(issue.id),
    }));
  });

  watch(sortOption, () => {
    userIssuesState.loadedCount = pageSize.value;
  });

  return {
    userIssuesState,
    hasMoreUserIssues: hasMore,
    visibleUserIssues: visibleIssues,
    bumpUserIssuesRequestToken,
    loadMoreUserIssues,
    addUserIssue,
    removeUserIssue,
    resetUserIssues,
    stopUserIssuesRequest,
    loadCurrentUserIssues,
  };
}
