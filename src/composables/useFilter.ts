import { ref } from 'vue';
import { getDefaultIssueRouteFilter } from '@/constants/categories';
import type { IssueRouteFilter } from '@/types';

const activeFilter = ref<IssueRouteFilter>(getDefaultIssueRouteFilter());

export function useFilter() {
  return {
    activeFilter,
  };
}
