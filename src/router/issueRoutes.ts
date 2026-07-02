import type { RouteLocationGeneric, RouteLocationNormalized, RouteRecordRaw } from 'vue-router';
import { DEFAULT_ISSUE_ROUTE_FILTER, isIssueRouteFilter, normalizeIssueRouteFilterParam } from '@/constants/categories';
import { normalizeRouteParam } from '@/lib/route';

function issueRouteRedirect(to: RouteLocationGeneric) {
  return {
    name: 'issues',
    params: { filter: DEFAULT_ISSUE_ROUTE_FILTER },
    query: to.query,
    hash: to.hash,
  };
}

function validateIssueRoute(to: RouteLocationNormalized) {
  const filter = normalizeIssueRouteFilterParam(to.params.filter);
  if (isIssueRouteFilter(to.params.filter)) return true;

  const issueId = normalizeRouteParam(to.params.issueId);

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
    redirect: issueRouteRedirect,
  },
  {
    path: '/issues',
    redirect: issueRouteRedirect,
  },
  {
    path: '/issues/:filter',
    name: 'issues',
    component: () => import('@/views/IssueBoardView.vue'),
    meta: { requiresAuth: true },
    beforeEnter: validateIssueRoute,
  },
  {
    path: '/issues/:filter/:issueId',
    name: 'issue-detail',
    component: () => import('@/views/IssueBoardView.vue'),
    meta: { requiresAuth: true },
    beforeEnter: validateIssueRoute,
  },
];
