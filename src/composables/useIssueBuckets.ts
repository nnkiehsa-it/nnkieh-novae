import { computed, onScopeDispose, reactive, watch, type Ref } from 'vue';
import { useNetworkStatus } from '@/composables/useNetworkStatus';
import { getIssueStatusBucket } from '@/lib/issue-timeline';
import { sortIssues } from '@/lib/issue-sort';
import { fetchIssuesPageByStatus } from '@/services/issues';
import { isContentCacheFresh, subscribeContentCacheInvalidations } from '@/services/content-read-cache';
import type { IssueCursor, IssueFilter, IssueRecord, IssueSortOption, IssueStatusBucket } from '@/types';
import { isAbortFailure } from '@/lib/request';

interface BucketState {
  cursor: IssueCursor | null;
  error: string;
  hasMore: boolean;
  initialized: boolean;
  issues: IssueRecord[];
  loading: boolean;
  loadingMore: boolean;
  refreshing: boolean;
  updatedAt: number;
  statusBucket: IssueStatusBucket;
  sortOption: IssueSortOption;
}

interface BucketDeps {
  user: Ref<{ uid: string } | null>;
  activeFilter: Ref<string>;
  isAdmin: Ref<boolean>;
  supportedIssueIds: Ref<Set<string>>;
  currentPageSize: Ref<number>;
  sortOption: Ref<IssueSortOption>;
}

const globalBucketCache = new Map<string, BucketState>();
const globalBucketVersions = new WeakMap<BucketState, number>();

export function invalidateIssueBucketMemory(issueId?: string) {
  globalBucketCache.forEach((bucket) => {
    if (issueId) bucket.issues = bucket.issues.filter((issue) => issue.id !== issueId);
    globalBucketVersions.set(bucket, (globalBucketVersions.get(bucket) ?? 0) + 1);
    bucket.loading = false;
    bucket.loadingMore = false;
    bucket.refreshing = false;
    bucket.updatedAt = 0;
  });
}

subscribeContentCacheInvalidations((prefix) => {
  if (prefix.startsWith('issue-list-page|')) invalidateIssueBucketMemory();
});

function createBucketState(statusBucket: IssueStatusBucket, sortOption: IssueSortOption): BucketState {
  return reactive({
    cursor: null,
    error: '',
    hasMore: true,
    initialized: false,
    issues: [],
    loading: false,
    loadingMore: false,
    refreshing: false,
    updatedAt: 0,
    statusBucket,
    sortOption,
  });
}

function mergeIssues(
  existing: IssueRecord[],
  incoming: IssueRecord[],
  statusBucket: IssueStatusBucket,
  sortOption: IssueSortOption,
) {
  const issueMap = new Map(existing.map((issue) => [issue.id, issue]));
  incoming.forEach((issue) => issueMap.set(issue.id, issue));
  return sortIssues(Array.from(issueMap.values()), statusBucket, sortOption);
}

export function useIssueBuckets(deps: BucketDeps) {
  const { user, activeFilter, isAdmin, supportedIssueIds, currentPageSize, sortOption } = deps;
  const { isOnline } = useNetworkStatus();
  const bucketControllers = new Map<BucketState, AbortController>();

  function getBucketKey(statusBucket: IssueStatusBucket) {
    return [
      user.value?.uid ?? '',
      isAdmin.value ? 'admin' : 'user',
      activeFilter.value,
      statusBucket,
      sortOption.value,
      currentPageSize.value,
    ].join(':');
  }

  function getBucketState(statusBucket: IssueStatusBucket) {
    const key = getBucketKey(statusBucket);
    const cachedBucket = globalBucketCache.get(key);
    if (cachedBucket) return cachedBucket;

    const bucket = createBucketState(statusBucket, sortOption.value);
    globalBucketCache.set(key, bucket);
    return bucket;
  }

  const activeState = computed(() => getBucketState('active'));
  const closedState = computed(() => getBucketState('closed'));

  function getBucketVersion(bucket: BucketState) {
    return globalBucketVersions.get(bucket) ?? 0;
  }

  function bumpBucketVersion(bucket: BucketState) {
    globalBucketVersions.set(bucket, getBucketVersion(bucket) + 1);
  }

  async function loadBucket(statusBucket: IssueStatusBucket, options: { append?: boolean; force?: boolean; silent?: boolean } = {}) {
    const bucket = getBucketState(statusBucket);
    if (activeFilter.value === 'my-proposals') return;
    if (options.append && (!bucket.hasMore || bucket.loadingMore)) return;
    if (!options.append && (bucket.loading || bucket.refreshing)) return;

    const version = getBucketVersion(bucket);
    const cursor = options.append ? bucket.cursor : null;
    bucketControllers.get(bucket)?.abort();
    const controller = new AbortController();
    bucketControllers.set(bucket, controller);
    bucket.error = '';
    if (options.append) {
      bucket.loadingMore = true;
    } else if (options.silent && bucket.issues.length > 0) {
      bucket.refreshing = true;
    } else {
      bucket.loading = true;
    }

    try {
      const result = await fetchIssuesPageByStatus(
        user.value?.uid ?? '',
        activeFilter.value as IssueFilter,
        statusBucket,
        cursor,
        {
          isAdmin: isAdmin.value,
          forceRefresh: options.force === true,
          pageSize: currentPageSize.value,
          sort: sortOption.value,
          supportedIssueIds: supportedIssueIds.value,
          signal: controller.signal,
        },
      );
      if (version !== getBucketVersion(bucket)) return;
      bucket.issues = options.append
        ? mergeIssues(bucket.issues, result.issues, statusBucket, sortOption.value)
        : sortIssues(result.issues, statusBucket, sortOption.value);
      bucket.cursor = result.cursor;
      bucket.hasMore = result.hasMore;
      bucket.initialized = true;
      bucket.error = '';
      bucket.updatedAt = Date.now();
    } catch (caught) {
      if (version !== getBucketVersion(bucket)) return;
      if (isAbortFailure(caught)) return;
      if (bucket.issues.length === 0 || options.append) {
        bucket.error = isOnline.value
          ? options.append ? 'issue.failedToLoadMoreProposalsPleaseTryAgainLater' : 'issue.proposalLoadingFailedPleaseTryAgainLater'
          : 'notification.offlineRefreshRequired';
      }
    } finally {
      if (version === getBucketVersion(bucket)) {
        bucket.loading = false;
        bucket.loadingMore = false;
        bucket.refreshing = false;
      }
      if (bucketControllers.get(bucket) === controller) bucketControllers.delete(bucket);
    }
  }

  function activateBucket(statusBucket: IssueStatusBucket) {
    const bucket = getBucketState(statusBucket);
    if (activeFilter.value === 'my-proposals' || bucket.loading || bucket.refreshing) return;
    if (bucket.initialized && isContentCacheFresh(bucket.updatedAt)) return;
    void loadBucket(statusBucket, { silent: bucket.initialized });
  }

  function refreshBucket(statusBucket: IssueStatusBucket) {
    const bucket = getBucketState(statusBucket);
    if (bucket.loading || bucket.refreshing) return Promise.resolve();
    bumpBucketVersion(bucket);
    bucket.cursor = null;
    bucket.hasMore = true;
    return loadBucket(statusBucket, { force: true, silent: true });
  }

  function loadMoreBucket(statusBucket: IssueStatusBucket) {
    return loadBucket(statusBucket, { append: true });
  }

  function patchCachedIssues(issueId: string, updater: (issue: IssueRecord) => IssueRecord) {
    globalBucketCache.forEach((bucket) => {
      if (!bucket.issues.some((issue) => issue.id === issueId)) return;
      bucket.issues = sortIssues(
        bucket.issues.map((issue) => issue.id === issueId ? updater(issue) : issue),
        bucket.statusBucket,
        bucket.sortOption,
      );
      bucket.updatedAt = Date.now();
    });
  }

  function addIssueToBucket(issue: IssueRecord) {
    if (activeFilter.value === 'my-proposals') return;
    const statusBucket = getIssueStatusBucket(issue);
    if (issue.category !== activeFilter.value) return;
    const bucket = getBucketState(statusBucket);
    bucket.issues = mergeIssues(bucket.issues, [issue], statusBucket, sortOption.value);
    bucket.initialized = true;
    bucket.updatedAt = Date.now();
  }

  function removeIssueFromBuckets(issueId: string) {
    globalBucketCache.forEach((bucket) => {
      bucket.issues = bucket.issues.filter((issue) => issue.id !== issueId);
    });
  }

  function invalidateIssueBuckets() {
    invalidateIssueBucketMemory();
    bucketControllers.forEach((controller) => controller.abort());
    bucketControllers.clear();
  }

  function upsertIssueAcrossBuckets(issue: IssueRecord) {
    // Drop the issue from every cached bucket first so a status move never leaves
    // the same card in both active and closed while the target bucket refreshes.
    removeIssueFromBuckets(issue.id);
    invalidateIssueBuckets();
    addIssueToBucket(issue);
  }

  watch(supportedIssueIds, (ids) => {
    globalBucketCache.forEach((bucket) => {
      bucket.issues = bucket.issues.map((issue) => ({
        ...issue,
        currentUserSupported: issue.currentUserSupported || ids.has(issue.id),
      }));
    });
  });

  onScopeDispose(() => {
    bucketControllers.forEach((controller) => controller.abort());
    bucketControllers.clear();
  });

  return {
    activeState,
    closedState,
    activateBucket,
    refreshBucket,
    loadMoreBucket,
    addIssueToBucket,
    removeIssueFromBuckets,
    invalidateIssueBuckets,
    upsertIssueAcrossBuckets,
    patchCachedIssues,
  };
}
