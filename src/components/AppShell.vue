<template>
  <div
    class="app-root relative flex flex-col bg-[rgb(var(--color-page-background))]"
    :data-bottom-nav="showMobileBottomNavigation ? 'true' : 'false'"
    :data-sidebar="isAllowedUser ? 'true' : 'false'"
    :data-sidebar-expanded="isSidebarExpanded ? 'true' : 'false'"
    :style="rootStyle"
    @focusin.capture="handleNavigationIntent"
    @pointerdown.capture="handleNavigationIntent"
    @pointerover.capture="handleNavigationIntent"
  >
    <div class="app-background-fill pointer-events-none absolute inset-0"></div>
    <div class="app-background-wash pointer-events-none absolute inset-x-0 top-0 h-80 dark:hidden"></div>

    <AppMobileHeader
      :back-label="mobileBackLabel"
      :category-filter="mobileCategoryFilter"
      :category-label="mobileCategoryLabel"
      :show-back-button="showMobileBackButton"
      :title="mobileHeaderTitle"
      @back="handleMobileBack"
      @select-category="handleCategoryChange"
    />

    <AppDesktopSidebar
      v-if="isAllowedUser"
      :expanded="isSidebarExpanded"
      :has-unread="hasUnread"
      :home-route="homeRoute"
      :items="primaryRouteNavItems"
      :notifications-active="route.name === 'notifications'"
      :photo-url="displayPhotoUrl"
      :profile-active="isProfileRouteActive"
      :school-label="schoolLabel"
      :user-name="userName"
      @navigate="handleNavigationClick"
      @navigate-link="closeSidebarDrawerIfNeeded"
      @toggle="toggleSidebar"
    />

    <button
      v-if="isAllowedUser"
      type="button"
      class="app-sidebar__scrim"
      :aria-label="t('navigation.collapseSidebar')"
      @click="closeSidebar"
    ></button>

    <div ref="mainContentRef" class="app-main-content relative flex flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-contain">
      <ViewportFrame as="main" class="flex min-h-0 flex-1 flex-col"><slot /></ViewportFrame>
    </div>

    <Transition name="mobile-nav">
      <AppMobileBottomNav
        v-if="showMobileBottomNavigation"
        :active-key="activeMobileNavKey"
        :bottom-gap="bottomGap"
        :has-unread="hasUnread"
        :items="primaryRouteNavItems"
        :photo-url="displayPhotoUrl"
        :profile-active="isProfileRouteActive"
        :user-name="userName"
        @navigate="handleNavigationClick"
      />
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppDesktopSidebar from '@/components/app-shell/AppDesktopSidebar.vue';
import AppMobileBottomNav from '@/components/app-shell/AppMobileBottomNav.vue';
import AppMobileHeader from '@/components/app-shell/AppMobileHeader.vue';
import ViewportFrame from '@/components/ui/organisms/ViewportFrame.vue';
import { SCHOOL_NAME } from '@/constants/app';
import { getDefaultIssueRouteFilter, getIssueCategoryLabel, isIssueCategory } from '@/constants/categories';
import { refreshFromActiveNavigation } from '@/composables/useActiveNavigationRefresh';
import { useCategories } from '@/composables/useCategories';
import { useIssueRouteFilter } from '@/composables/useIssueRouteFilter';
import { useNotificationBadge } from '@/composables/useNotificationBadge';
import { useSession } from '@/composables/useSession';
import type { IssueFilter } from '@/types';
import { preloadRoutePath } from '@/router/route-components';
import { returnToNavigationOrigin } from '@/router/navigation-hierarchy';
import { getDefaultAuthenticatedRoute } from '@/router/default-route';
import { useI18n } from '@/i18n';

const SIDEBAR_EXPANDED_STORAGE_KEY = 'novae:desktop-sidebar-expanded';
const MOBILE_NAV_HEIGHT = 60;
const SCROLL_POSITION_LIMIT = 30;

const { customPhotoUrl, isAllowedUser, user } = useSession();
const { facilitiesEnabled, issuesEnabled } = useCategories();
const { activeFilter } = useIssueRouteFilter();
const { hasUnread } = useNotificationBadge();
const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const mainContentRef = ref<HTMLDivElement | null>(null);
const hasSafeIndicator = ref(false);
const isSidebarExpanded = ref(false);
const mainScrollPositions = new Map<string, number>();

const isIssueRouteActive = computed(() => route.name === 'issues' || route.name === 'issue-detail');
const isAnnouncementRouteActive = computed(() => route.name === 'announcements' || route.name === 'announcement-detail');
const isFacilityRouteActive = computed(() => route.name === 'facilities' || route.name === 'facility-detail');
const isMyProposalsRouteActive = computed(() => isIssueRouteActive.value && activeFilter.value === 'my-proposals');
const isProfileRouteActive = computed(() => isMyProposalsRouteActive.value || ['settings', 'dashboard', 'administration'].includes(route.name as string));
const homeRoute = computed(() => getDefaultAuthenticatedRoute());
const primaryRouteNavItems = computed(() => [
  issuesEnabled.value ? {
    icon: 'comment' as const,
    isActive: isIssueRouteActive.value && activeFilter.value !== 'my-proposals',
    key: 'issues',
    label: t('issue.proposal'),
    to: homeRoute.value,
  } : null,
  facilitiesEnabled.value ? {
    icon: 'wrench' as const,
    isActive: isFacilityRouteActive.value,
    key: 'facilities',
    label: t('facility.facility'),
    to: { name: 'facilities' },
  } : null,
  {
    icon: 'megaphone' as const,
    isActive: isAnnouncementRouteActive.value,
    key: 'announcements',
    label: t('announcement.announcement'),
    to: { name: 'announcements' },
  },
].filter((item): item is NonNullable<typeof item> => item !== null));
const displayPhotoUrl = computed(() => customPhotoUrl.value || user.value?.photoURL || null);
const userName = computed(() => user.value?.displayName || t('navigation.user'));
const schoolLabel = computed(() => SCHOOL_NAME || t('navigation.theSchoolHasNotBeenSet'));
const mobileCategoryFilter = computed<IssueFilter | undefined>(() =>
  route.name === 'issues' && isIssueCategory(activeFilter.value) ? activeFilter.value : undefined
);
const mobileCategoryLabel = computed(() => mobileCategoryFilter.value
  ? getIssueCategoryLabel(mobileCategoryFilter.value)
  : undefined);
const bottomGap = computed(() => hasSafeIndicator.value ? 25 : 15);
const showMobileBottomNavigation = computed(() => isAllowedUser.value);
const rootStyle = computed(() => ({
  '--app-bottom-nav-height': showMobileBottomNavigation.value
    ? `${bottomGap.value + MOBILE_NAV_HEIGHT + 6}px`
    : '0px',
}));
const activeMobileNavKey = computed(() => {
  if (isAnnouncementRouteActive.value) return 'announcements';
  if (isFacilityRouteActive.value) return 'facilities';
  if (isProfileRouteActive.value) return 'settings';
  if (route.name === 'notifications') return 'notifications';
  if (isIssueRouteActive.value) return 'issues';
  return '';
});
const mobileHeaderTitle = computed(() => {
  if (route.name === 'issue-detail') return t(isMyProposalsRouteActive.value ? 'issue.myProposal' : 'issue.proposalContent');
  if (route.name === 'facility-detail') return t('facility.facility');
  if (route.name === 'announcement-detail') return t('announcement.announcementContent');
  if (route.name === 'dashboard') return t('dashboard.statistics');
  if (route.name === 'administration') return t('adminCenter.title');
  if (route.name === 'notifications') return t('navigation.notify');
  if (route.name === 'settings') return t('settings.mine');
  if (isAnnouncementRouteActive.value) return t('announcement.announcement');
  if (isFacilityRouteActive.value) return t('facility.facility');
  if (isMyProposalsRouteActive.value) return t('issue.myProposal');
  return t('issue.proposal');
});
const showMobileBackButton = computed(() => ['issue-detail', 'facility-detail', 'announcement-detail', 'dashboard', 'administration'].includes(route.name as string) || isMyProposalsRouteActive.value);
const mobileBackLabel = computed(() => {
  if (route.name === 'dashboard') return t('navigation.returnMy');
  if (route.name === 'administration') return t('navigation.returnMy');
  if (route.name === 'issue-detail' && isMyProposalsRouteActive.value) return t('issue.returnToMyProposal');
  if (isMyProposalsRouteActive.value) return t('navigation.returnMy');
  if (route.name === 'announcement-detail') return t('announcement.returnToAnnouncementList');
  if (route.name === 'facility-detail') return t('facility.backToFacilityList');
  return t('issue.returnToProposalList');
});

function handleNavigationClick(isActive: boolean) {
  if (isActive) void refreshFromActiveNavigation();
}

async function handleCategoryChange(filter: IssueFilter) {
  if (filter === activeFilter.value && route.name === 'issues') return;
  await router.push({ name: 'issues', params: { filter }, query: route.query });
}

function handleNavigationIntent(event: Event) {
  if (!(event.target instanceof Element)) return;
  const link = event.target.closest<HTMLAnchorElement>('a[href]');
  if (!link) return;

  const url = new URL(link.href, window.location.origin);
  if (url.origin !== window.location.origin) return;
  void preloadRoutePath(url.pathname);
}

function setSidebarExpanded(expanded: boolean) {
  isSidebarExpanded.value = expanded;
  window.localStorage.setItem(SIDEBAR_EXPANDED_STORAGE_KEY, expanded ? 'true' : 'false');
}

function toggleSidebar() {
  setSidebarExpanded(!isSidebarExpanded.value);
}

function closeSidebar() {
  setSidebarExpanded(false);
}

function closeSidebarDrawerIfNeeded() {
  if (window.matchMedia('(min-width: 768px) and (max-width: 1399px)').matches) closeSidebar();
}

function handleSidebarKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && isSidebarExpanded.value) closeSidebarDrawerIfNeeded();
}

async function handleMobileBack() {
  if (returnToNavigationOrigin(router)) return;
  if (route.name === 'announcement-detail') return void await router.replace({ name: 'announcements' });
  if (route.name === 'facility-detail') return void await router.replace({ name: 'facilities' });
  if (route.name === 'issue-detail') {
    const query = { ...route.query };
    delete query.tab;
    delete query.comment;
    return void await router.replace({ name: 'issues', params: { filter: activeFilter.value }, query });
  }
  if (isMyProposalsRouteActive.value || route.name === 'dashboard' || route.name === 'administration') await router.replace({ name: 'settings' });
}

watch(() => route.fullPath, (newPath, oldPath) => {
  if (oldPath && mainContentRef.value) {
    mainScrollPositions.set(oldPath, mainContentRef.value.scrollTop);
    if (mainScrollPositions.size > SCROLL_POSITION_LIMIT) {
      const oldestPath = mainScrollPositions.keys().next().value;
      if (oldestPath) mainScrollPositions.delete(oldestPath);
    }
  }
  nextTick(() => mainContentRef.value?.scrollTo({ behavior: 'auto', left: 0, top: mainScrollPositions.get(newPath) ?? 0 }));
});

onMounted(() => {
  isSidebarExpanded.value = window.localStorage.getItem(SIDEBAR_EXPANDED_STORAGE_KEY) === 'true';
  const probe = document.createElement('div');
  probe.style.cssText = 'padding-bottom:env(safe-area-inset-bottom);position:fixed;visibility:hidden';
  document.body.appendChild(probe);
  hasSafeIndicator.value = parseFloat(window.getComputedStyle(probe).paddingBottom) > 0;
  probe.remove();
  window.addEventListener('keydown', handleSidebarKeydown);
});

onBeforeUnmount(() => window.removeEventListener('keydown', handleSidebarKeydown));
</script>
