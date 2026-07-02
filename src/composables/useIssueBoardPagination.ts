import { computed, type Ref } from 'vue';
import type { IssueFilter, IssueRecord } from '@/types';

type IssueBoardFilter = IssueFilter | 'my-proposals';

interface IssueBoardPaginationOptions {
  activeFilter: Ref<IssueBoardFilter>;
  statusTab: Ref<'active' | 'closed'>;
  searchQuery: Ref<string>;
  canSearchGlobally: Ref<boolean>;
  isSearching: Ref<boolean>;
  searchIssues: Ref<IssueRecord[]>;
  userIssues: Ref<IssueRecord[]>;
  pageSize: Ref<number>;
  filterIssues: (issues: IssueRecord[]) => IssueRecord[];
}

export function useIssueBoardPagination(options: IssueBoardPaginationOptions) {
  const isGlobalMode = computed(() => {
    if (options.activeFilter.value === 'my-proposals') return true;
    if (options.canSearchGlobally.value) return true;
    return false;
  });

  const globalFilteredIssues = computed(() => {
    if (!isGlobalMode.value) return [];

    let list: IssueRecord[];
    if (options.activeFilter.value === 'my-proposals') {
      list = options.userIssues.value;
    } else {
      list = options.searchIssues.value;
    }

    if (
      options.isSearching.value
      && !(options.activeFilter.value !== 'my-proposals' && options.canSearchGlobally.value)
    ) {
      list = options.filterIssues(list);
    }
    return list;
  });

  const globalTotalPages = computed(() => {
    return globalFilteredIssues.value.length > 0 ? 1 : 0;
  });

  const globalCurrentPageIssues = computed(() => {
    return globalFilteredIssues.value;
  });

  return {
    globalPage: computed(() => 1),
    globalPageSize: options.pageSize,
    isGlobalMode,
    globalFilteredIssues,
    globalTotalPages,
    globalCurrentPageIssues,
  };
}
