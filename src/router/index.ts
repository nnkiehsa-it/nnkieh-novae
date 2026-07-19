import { createRouter, createWebHistory } from 'vue-router';
import { adminRoutes } from '@/router/adminRoutes';
import { announcementRoutes } from '@/router/announcementRoutes';
import { authRoutes } from '@/router/authRoutes';
import { issueRoutes } from '@/router/issueRoutes';
import { facilityRoutes } from '@/router/facilityRoutes';
import { notificationRoutes } from '@/router/notificationRoutes';
import { settingsRoutes } from '@/router/settingsRoutes';
import { getDefaultIssueRouteFilter } from '@/constants/categories';
import { ensureCategoryCatalog } from '@/composables/useCategories';
import { resetRouteRequestScope } from '@/lib/route-request';
import { useSession, waitForRoleReady, waitForSessionReady } from '@/composables/useSession';
import type { PermissionCode } from '@/services/session-role';

declare module 'vue-router' {
  interface RouteMeta {
    navigationDepth?: number;
    publicOnly?: boolean;
    requiresAdmin?: boolean;
    requiresAuth?: boolean;
    requiredPermission?: PermissionCode;
    setupAllowed?: boolean;
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
    ...facilityRoutes,
    ...announcementRoutes,
    ...adminRoutes,
    ...notificationRoutes,
    ...settingsRoutes,
  ],
});

function defaultAuthenticatedRoute() {
  return {
    name: 'issues',
    params: { filter: getDefaultIssueRouteFilter() },
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

  const { can, isAdmin, setupCompleted, user } = useSession();

  if (to.meta.publicOnly && user.value) {
    return normalizeRedirectPath(to.query.redirect) || defaultAuthenticatedRoute();
  }

  if (to.meta.requiresAuth && !user.value) {
    return {
      name: 'login',
      query: { redirect: to.fullPath },
    };
  }

  if (to.meta.requiresAdmin) {
    const roleReady = await waitForRoleReady();
    if (!roleReady || !isAdmin.value) {
      return defaultAuthenticatedRoute();
    }
  }

  if (user.value) {
    const roleReady = await waitForRoleReady();
    if (!roleReady) return false;
    if (!setupCompleted.value && !to.meta.setupAllowed) return { name: 'setup' };
    if (setupCompleted.value && to.name === 'setup') {
      await ensureCategoryCatalog();
      return defaultAuthenticatedRoute();
    }
    if (setupCompleted.value) await ensureCategoryCatalog();
  }
  if (to.meta.requiredPermission) {
    const roleReady = await waitForRoleReady();
    if (!roleReady || !can(to.meta.requiredPermission)) return defaultAuthenticatedRoute();
  }

  return true;
});

export default router;
