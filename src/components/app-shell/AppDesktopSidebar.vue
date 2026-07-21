<template>
  <aside
    class="app-sidebar fixed inset-y-0 left-0 z-40 hidden flex-col border-0 bg-surface/94 py-4 shadow-card backdrop-blur-xl dark:bg-surface/94 md:flex"
    :aria-label="t('navigation.desktopMainNavigation')"
    @click="handleSidebarClick"
  >
    <div class="app-sidebar__header">
      <RouterLink
        :to="homeRoute"
        class="app-sidebar__brand"
        :aria-label="t('navigation.home')"
      >
        <BrandMark />
        <span class="app-sidebar__brand-label">Novae</span>
      </RouterLink>
      <button
        type="button"
        class="app-sidebar__toggle"
        :aria-label="t(expanded ? 'navigation.collapseSidebar' : 'navigation.expandSidebar')"
        :title="t(expanded ? 'navigation.collapseSidebar' : 'navigation.expandSidebar')"
        :aria-expanded="expanded"
        @click.stop="$emit('toggle')"
      >
        <AppIcon :name="expanded ? 'chevron-left' : 'chevron-right'" :size="3.5" />
      </button>
    </div>

    <nav class="mt-7 flex w-full flex-1 flex-col gap-2 px-3" :aria-label="t('navigation.primaryNavigation')">
      <RouterLink
        v-for="item in items"
        :key="item.key"
        :to="item.to"
        class="app-sidebar__item"
        :class="{ 'app-sidebar__item--active': item.isActive }"
        :aria-label="item.label"
        :data-label="item.label"
        @click="$emit('navigate', item.isActive)"
      >
        <AppIcon :name="item.icon" :size="5" :stroke-width="1.9" />
        <span class="app-sidebar__label">{{ item.label }}</span>
      </RouterLink>

      <RouterLink
        to="/notifications"
        class="app-sidebar__item"
        :class="{ 'app-sidebar__item--active': notificationsActive }"
        :aria-label="t(hasUnread ? 'notification.notificationsUnread' : 'navigation.notify')"
        :data-label="t('navigation.notify')"
      >
        <span class="relative inline-flex" aria-hidden="true">
          <AppIcon name="bell" :size="5" :stroke-width="1.9" />
          <span v-if="hasUnread" class="app-sidebar__badge"></span>
        </span>
        <span class="app-sidebar__label">{{ t('navigation.notify') }}</span>
      </RouterLink>
    </nav>

    <RouterLink
      to="/settings"
      class="app-sidebar__profile"
      :class="{ 'app-sidebar__item--active': profileActive }"
      :aria-label="t('settings.mine')"
      :data-label="t('settings.mine')"
    >
      <UserAvatar :photo-url="photoUrl" :name="userName" size="sm" :alt-text="t('settings.userAvatar')" class="!h-8 !w-8 rounded-full" />
      <span class="app-sidebar__profile-copy">
        <strong>{{ userName }}</strong>
        <span>{{ schoolLabel }}</span>
      </span>
    </RouterLink>
  </aside>
</template>

<script setup lang="ts">
import { RouterLink, type RouteLocationRaw } from 'vue-router';
import AppIcon from '@/components/ui/atoms/AppIcon.vue';
import BrandMark from '@/components/ui/atoms/BrandMark.vue';
import UserAvatar from '@/components/ui/atoms/UserAvatar.vue';
import type { AppNavigationItem } from './types';
import { useI18n } from '@/i18n';

const { t } = useI18n();

defineProps<{
  expanded: boolean;
  hasUnread: boolean;
  homeRoute: RouteLocationRaw;
  items: AppNavigationItem[];
  notificationsActive: boolean;
  photoUrl: string | null;
  profileActive: boolean;
  schoolLabel: string;
  userName: string;
}>();

const emit = defineEmits<{
  navigate: [isActive: boolean];
  'navigate-link': [];
  toggle: [];
}>();

function handleSidebarClick(event: MouseEvent) {
  if (event.target instanceof Element && event.target.closest('a[href]')) emit('navigate-link');
}
</script>
