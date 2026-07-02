import { ref } from 'vue';
import { DEFAULT_ISSUE_ROUTE_FILTER } from '@/constants/categories';
import type { IssueRouteFilter } from '@/types';

const activeFilter = ref<IssueRouteFilter>(DEFAULT_ISSUE_ROUTE_FILTER);

export function useFilter() {
  return {
    activeFilter,
  };
}
