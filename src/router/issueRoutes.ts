import type { RouteLocationGeneric, RouteLocationNormalized, RouteRecordRaw } from 'vue-router';
import { getDefaultIssueRouteFilter, isIssueRouteFilter, isKnownIssueCategory, normalizeIssueRouteFilterParam } from '@/constants/categories';
import { ensureCategoryCatalog } from '@/composables/useCategories';
import { normalizeRouteParam } from '@/lib/route';
import { loadIssueBoardView, loadIssueDetailView } from '@/router/route-components';

async function issueRouteRedirect(to: RouteLocationGeneric) {
  await ensureCategoryCatalog();
  return {
    name: 'issues',
    params: { filter: getDefaultIssueRouteFilter() },
    query: to.query,
    hash: to.hash,
  };
}

function validateIssueRoute(to: RouteLocationNormalized) {
  const filter = normalizeIssueRouteFilterParam(to.params.filter);
  const issueId = normalizeRouteParam(to.params.issueId);
  const rawFilter = normalizeRouteParam(to.params.filter);
  if (isIssueRouteFilter(to.params.filter) || (issueId && isKnownIssueCategory(rawFilter))) return true;

  return {
    name: issueId ? 'issue-detail' : 'issues',
    params: issueId ? { filter, issueId } : { filter },
    query: to.query,
    hash: to.hash,
  };
}

export const issueRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'issue-entry-root',
    component: loadIssueBoardView,
    meta: { navigationDepth: 0, requiresAuth: true },
    beforeEnter: issueRouteRedirect,
  },
  {
    path: '/issues',
    name: 'issue-entry',
    component: loadIssueBoardView,
    meta: { navigationDepth: 0, requiresAuth: true },
    beforeEnter: issueRouteRedirect,
  },
  {
    path: '/issues/:filter',
    name: 'issues',
    component: loadIssueBoardView,
    meta: { navigationDepth: 0, requiresAuth: true },
    beforeEnter: validateIssueRoute,
  },
  {
    path: '/issues/:filter/:issueId',
    name: 'issue-detail',
    component: loadIssueDetailView,
    meta: { navigationDepth: 1, requiresAuth: true },
    beforeEnter: validateIssueRoute,
  },
];
