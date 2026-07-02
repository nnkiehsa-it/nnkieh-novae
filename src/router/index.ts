import { createRouter, createWebHistory } from 'vue-router';
import { adminRoutes } from '@/router/adminRoutes';
import { announcementRoutes } from '@/router/announcementRoutes';
import { authRoutes } from '@/router/authRoutes';
import { changelogRoutes } from '@/router/changelogRoutes';
import { issueRoutes } from '@/router/issueRoutes';
import { notificationRoutes } from '@/router/notificationRoutes';
import { settingsRoutes } from '@/router/settingsRoutes';
import { DEFAULT_ISSUE_ROUTE_FILTER } from '@/constants/categories';
import { resetRouteRequestScope } from '@/lib/route-request';
import { useSession, waitForSessionReady } from '@/composables/useSession';

declare module 'vue-router' {
  interface RouteMeta {
    publicOnly?: boolean;
    requiresAdmin?: boolean;
    requiresAuth?: boolean;
  }
}

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior() {
    return { left: 0, top: 0 };
  },
  routes: [
    ...authRoutes,
    ...issueRoutes,
    ...announcementRoutes,
    ...changelogRoutes,
    ...adminRoutes,
    ...notificationRoutes,
    ...settingsRoutes,
  ],
});

function defaultAuthenticatedRoute() {
  return {
    name: 'issues',
    params: { filter: DEFAULT_ISSUE_ROUTE_FILTER },
  };
}

function normalizeRedirectPath(value: unknown) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const path = typeof rawValue === 'string' ? rawValue.trim() : '';

  if (!path || !path.startsWith('/') || path.startsWith('//') || path.startsWith('/login')) {
    return '';
  }

  return path;
}

router.beforeEach(async (to) => {
  resetRouteRequestScope();
  await waitForSessionReady();

  const { isAdmin, user } = useSession();

  if (to.meta.publicOnly && user.value) {
    return normalizeRedirectPath(to.query.redirect) || defaultAuthenticatedRoute();
  }

  if (to.meta.requiresAuth && !user.value) {
    return {
      name: 'login',
      query: { redirect: to.fullPath },
    };
  }

  if (to.meta.requiresAdmin && !isAdmin.value) {
    return defaultAuthenticatedRoute();
  }

  return true;
});

export default router;
