import { getDefaultIssueRouteFilter } from '@/constants/categories';
import { getPlatformFeaturesSnapshot } from '@/composables/useCategories';

const ISSUE_ROUTE_NAMES = new Set(['issue-detail', 'issues']);
const FACILITY_ROUTE_NAMES = new Set(['facilities', 'facility-detail']);

export function getDefaultAuthenticatedRoute() {
  const features = getPlatformFeaturesSnapshot();
  if (features.issuesEnabled) {
    return { name: 'issues', params: { filter: getDefaultIssueRouteFilter() } } as const;
  }
  if (features.facilitiesEnabled) return { name: 'facilities' } as const;
  return { name: 'announcements' } as const;
}

export function isFeatureRouteEnabled(routeName: unknown) {
  const name = typeof routeName === 'string' ? routeName : '';
  const features = getPlatformFeaturesSnapshot();
  if (ISSUE_ROUTE_NAMES.has(name)) return features.issuesEnabled;
  if (FACILITY_ROUTE_NAMES.has(name)) return features.facilitiesEnabled;
  return true;
}
