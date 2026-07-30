import { getDefaultIssueRouteFilter } from '@/constants/categories';
import { getPlatformFeaturesSnapshot } from '@/composables/useCategories';
import {
  getDefaultFeatureRoute,
  isRouteEnabledByFeatures,
} from '@/lib/feature-access';

export function getDefaultAuthenticatedRoute() {
  return getDefaultFeatureRoute(
    getPlatformFeaturesSnapshot(),
    getDefaultIssueRouteFilter(),
  );
}

export function isFeatureRouteEnabled(routeName: unknown) {
  return isRouteEnabledByFeatures(routeName, getPlatformFeaturesSnapshot());
}
