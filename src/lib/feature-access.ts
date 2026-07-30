import type { PlatformFeatures } from '@/types/categories';

const ISSUE_ROUTE_NAMES = new Set(['issue-create', 'issue-detail', 'issues']);
const FACILITY_ROUTE_NAMES = new Set(['facilities', 'facility-create', 'facility-detail']);

export function getDefaultFeatureRoute(
  features: PlatformFeatures,
  defaultIssueFilter: string,
) {
  if (features.issuesEnabled) {
    return { name: 'issues', params: { filter: defaultIssueFilter } } as const;
  }
  if (features.facilitiesEnabled) return { name: 'facilities' } as const;
  return { name: 'announcements' } as const;
}

export function isRouteEnabledByFeatures(
  routeName: unknown,
  features: PlatformFeatures,
) {
  const name = typeof routeName === 'string' ? routeName : '';
  if (ISSUE_ROUTE_NAMES.has(name)) return features.issuesEnabled;
  if (FACILITY_ROUTE_NAMES.has(name)) return features.facilitiesEnabled;
  return true;
}
