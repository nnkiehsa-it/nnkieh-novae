import type { RouteRecordRaw } from 'vue-router';

export const changelogRoutes: RouteRecordRaw[] = [
  {
    path: '/changelog',
    name: 'changelog',
    component: () => import('@/views/ChangelogView.vue'),
    meta: { requiresAuth: true },
  },
];
