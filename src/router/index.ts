import { createRouter, createWebHistory } from 'vue-router';
import { adminRoutes } from '@/router/adminRoutes';
import { announcementRoutes } from '@/router/announcementRoutes';
import { authRoutes } from '@/router/authRoutes';
import { issueRoutes } from '@/router/issueRoutes';
import { facilityRoutes } from '@/router/facilityRoutes';
import { notificationRoutes } from '@/router/notificationRoutes';
import { settingsRoutes } from '@/router/settingsRoutes';
import { ensureCategoryCatalog } from '@/composables/useCategories';
import { resetRouteRequestScope } from '@/lib/route-request';
import { useSession, waitForRoleReady, waitForSessionReady } from '@/composables/useSession';
import type { PermissionCode } from '@/services/session-role';
import { getDefaultAuthenticatedRoute, isFeatureRouteEnabled } from '@/router/default-route';

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

function normalizeRedirectPath(value: unknown) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const path = typeof rawValue === 'string' ? rawValue.trim() : '';

  if (!path || !path.startsWith('/') || path.startsWith('//') || path.startsWith('/login')) {
    return '';
  }

  return path;
}

async function ensureCategoryCatalogForNavigation() {
  try {
    await ensureCategoryCatalog();
  } catch {
    // The authenticated route can use feature defaults until the catalog reloads.
    // Never leave an accepted user on /login because this optional read failed.
  }
}

async function resolveAuthenticatedDestination(
  to: { name?: unknown; fullPath: string; query: Record<string, unknown>; meta: { setupAllowed?: boolean } },
  session: ReturnType<typeof useSession>,
) {
  const roleReady = await waitForRoleReady();
  // Role bootstrap is still in flight; cancel this pass and let the app-level
  // watcher retry once roleLoading settles (avoids cancelling login→home forever).
  if (!roleReady) return false;

  if (!session.setupCompleted.value && !to.meta.setupAllowed) {
    return { name: 'setup' as const };
  }

  if (session.setupCompleted.value) {
    await ensureCategoryCatalogForNavigation();
    if (to.name === 'setup' || !isFeatureRouteEnabled(to.name)) {
      return getDefaultAuthenticatedRoute();
    }
  }

  return true;
}

router.beforeEach(async (to) => {
  resetRouteRequestScope();
  await waitForSessionReady();

  const session = useSession();
  const { can, isAdmin, user } = session;

  if (to.meta.publicOnly && user.value) {
    const roleReady = await waitForRoleReady();
    if (!roleReady) return false;
    if (!session.setupCompleted.value) return { name: 'setup' };
    await ensureCategoryCatalogForNavigation();
    return normalizeRedirectPath(to.query.redirect) || getDefaultAuthenticatedRoute();
  }

  if (to.meta.requiresAuth && !user.value) {
    return {
      name: 'login',
      query: { redirect: to.fullPath },
    };
  }

  if (user.value) {
    const destination = await resolveAuthenticatedDestination(to, session);
    if (destination !== true) return destination;
  }

  if (to.meta.requiresAdmin) {
    const roleReady = await waitForRoleReady();
    if (!roleReady || !isAdmin.value) {
      return getDefaultAuthenticatedRoute();
    }
  }

  if (to.meta.requiredPermission) {
    const roleReady = await waitForRoleReady();
    if (!roleReady || !can(to.meta.requiredPermission)) return getDefaultAuthenticatedRoute();
  }

  return true;
});

export default router;
