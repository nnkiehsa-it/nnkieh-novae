import type { RouteRecordRaw } from 'vue-router';
import { loadAccessManagementView, loadCategoryManagementView, loadDashboardView, loadSetupView } from '@/router/route-components';

export const adminRoutes: RouteRecordRaw[] = [
  {
    path: '/setup', name: 'setup', component: loadSetupView,
    meta: { navigationDepth: 0, requiresAuth: true, setupAllowed: true },
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: loadDashboardView,
    meta: { navigationDepth: 1, requiresAuth: true, requiredPermission: 'dashboard.view' },
  },
  {
    path: '/admin/access', name: 'access-management', component: loadAccessManagementView,
    meta: { navigationDepth: 1, requiresAuth: true, requiredPermission: 'role.manage' },
  },
  {
    path: '/admin/categories', name: 'category-management', component: loadCategoryManagementView,
    meta: { navigationDepth: 1, requiresAuth: true, requiredPermission: 'category.manage' },
  },
];
