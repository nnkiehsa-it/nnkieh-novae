type RouteComponentLoader = () => Promise<unknown>;

export const loadLoginView = () => import('@/views/LoginView.vue');
export const loadIssueBoardView = () => import('@/views/IssueBoardView.vue');
export const loadIssueComposerView = () => import('@/views/IssueComposerView.vue');
export const loadIssueDetailView = () => import('@/views/IssueDetailView.vue');
export const loadFacilitiesView = () => import('@/views/FacilitiesView.vue');
export const loadFacilityComposerView = () => import('@/views/FacilityComposerView.vue');
export const loadFacilityDetailView = () => import('@/views/FacilityDetailView.vue');
export const loadAdministrationView = () => import('@/views/AdministrationView.vue');
export const loadAnnouncementsView = () => import('@/views/AnnouncementsView.vue');
export const loadAnnouncementComposerView = () => import('@/views/AnnouncementComposerView.vue');
export const loadAnnouncementDetailView = () => import('@/views/AnnouncementDetailView.vue');
export const loadNotificationsView = () => import('@/views/NotificationsView.vue');
export const loadSettingsView = () => import('@/views/SettingsView.vue');
export const loadDashboardView = () => import('@/views/DashboardView.vue');
export const loadSetupView = () => import('@/views/SetupView.vue');

const loaders = new Map<string, RouteComponentLoader>([
  ['login', loadLoginView],
  ['issues', loadIssueBoardView],
  ['issue-create', loadIssueComposerView],
  ['issue-detail', loadIssueDetailView],
  ['facilities', loadFacilitiesView],
  ['facility-create', loadFacilityComposerView],
  ['facility-detail', loadFacilityDetailView],
  ['administration', loadAdministrationView],
  ['announcements', loadAnnouncementsView],
  ['announcement-create', loadAnnouncementComposerView],
  ['announcement-detail', loadAnnouncementDetailView],
  ['notifications', loadNotificationsView],
  ['settings', loadSettingsView],
  ['dashboard', loadDashboardView],
  ['setup', loadSetupView],
]);
const preloadRequests = new Map<string, Promise<unknown>>();

export function preloadRouteComponent(routeName: string) {
  const existing = preloadRequests.get(routeName);
  if (existing) return existing;
  const loader = loaders.get(routeName);
  if (!loader) return Promise.resolve();

  const request = loader().catch(() => undefined);
  preloadRequests.set(routeName, request);
  return request;
}

export function preloadRoutePath(pathname: string) {
  if (pathname === '/notifications') return preloadRouteComponent('notifications');
  if (pathname === '/settings') return preloadRouteComponent('settings');
  if (pathname === '/dashboard') return preloadRouteComponent('dashboard');
  if (pathname === '/admin/management' || pathname === '/admin/access' || pathname === '/admin/categories') {
    return preloadRouteComponent('administration');
  }
  if (pathname === '/setup') return preloadRouteComponent('setup');
  if (pathname === '/facilities/new') return preloadRouteComponent('facility-create');
  if (pathname.startsWith('/facilities/')) return preloadRouteComponent('facility-detail');
  if (pathname === '/facilities') return preloadRouteComponent('facilities');
  if (pathname === '/announcements/new') return preloadRouteComponent('announcement-create');
  if (pathname.startsWith('/announcements/')) return preloadRouteComponent('announcement-detail');
  if (pathname === '/announcements') return preloadRouteComponent('announcements');
  if (/^\/issues\/[^/]+\/new$/u.test(pathname)) return preloadRouteComponent('issue-create');
  if (/^\/issues\/[^/]+\/[^/]+/u.test(pathname)) return preloadRouteComponent('issue-detail');
  if (pathname === '/' || pathname.startsWith('/issues')) return preloadRouteComponent('issues');
  return Promise.resolve();
}

export async function preloadPrimaryRouteComponents(includeAdmin: boolean) {
  const routeNames = [
    'login',
    'announcements',
    'announcement-create',
    'announcement-detail',
    'facilities',
    'facility-create',
    'facility-detail',
    'issue-create',
    'issue-detail',
    'issues',
    'notifications',
    'settings',
    'setup',
    ...(includeAdmin ? ['dashboard'] : []),
    ...(includeAdmin ? ['administration'] : []),
  ];
  await Promise.all(routeNames.map(preloadRouteComponent));
}
