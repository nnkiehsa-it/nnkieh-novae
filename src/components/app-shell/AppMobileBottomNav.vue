<template>
  <nav
    class="app-bottom-nav viewport-floating-inline fixed z-40 mx-auto max-w-md rounded-full border-0 bg-surface/94 px-3 py-1.5 shadow-floating backdrop-blur-xl dark:bg-surface/94 md:hidden"
    :style="{ bottom: `${bottomGap}px` }"
    :aria-label="t('navigation.primaryNavigation')"
  >
    <div
      class="app-bottom-nav__inner relative mx-auto grid"
      :style="{ gridTemplateColumns: `repeat(${items.length + 2}, minmax(0, 1fr))` }"
    >
      <m.div
        v-if="activeIndex >= 0"
        class="app-bottom-nav__active-indicator"
        :initial="false"
        :animate="{ x: `${activeIndex * 100}%` }"
        :transition="MOTION_SMOOTH_SPRING"
        :style="{ width: `${100 / itemCount}%` }"
        aria-hidden="true"
      />

      <RouterLink
        v-for="item in items"
        :key="item.key"
        :to="item.to"
        class="app-bottom-nav__item"
        :class="{ 'app-bottom-nav__item--active': item.isActive }"
        @click="$emit('navigate', item.isActive)"
      >
        <span class="app-bottom-nav__icon" aria-hidden="true">
          <AppIcon :name="item.icon" :size="4.5" :stroke-width="1.9" />
        </span>
        <span class="app-bottom-nav__label">{{ item.label }}</span>
      </RouterLink>

      <RouterLink
        to="/notifications"
        class="app-bottom-nav__item"
        :class="{ 'app-bottom-nav__item--active': activeKey === 'notifications' }"
        :aria-label="t(hasUnread ? 'notification.notificationsUnread' : 'navigation.notify')"
        @click="$emit('navigate', activeKey === 'notifications')"
      >
        <span class="app-bottom-nav__icon relative" aria-hidden="true">
          <AppIcon name="bell" :size="4.5" :stroke-width="1.9" />
          <span v-if="hasUnread" class="app-bottom-nav__badge absolute h-2 w-2 rounded-full bg-error"></span>
        </span>
        <span class="app-bottom-nav__label">{{ t('navigation.notify') }}</span>
      </RouterLink>

      <RouterLink
        to="/settings"
        class="app-bottom-nav__item overflow-visible"
        :class="{ 'app-bottom-nav__item--active': profileActive }"
      >
        <span class="app-bottom-nav__icon overflow-hidden rounded-full" aria-hidden="true">
          <UserAvatar :photo-url="photoUrl" :name="userName" size="sm" :alt-text="t('settings.userAvatar')" class="!h-5 !w-5 rounded-full" />
        </span>
        <span class="app-bottom-nav__label">{{ t('settings.mine') }}</span>
      </RouterLink>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { computed } from 'vue';
import { m } from 'motion-v';
import AppIcon from '@/components/ui/atoms/AppIcon.vue';
import UserAvatar from '@/components/ui/atoms/UserAvatar.vue';
import type { AppNavigationItem } from './types';
import { useI18n } from '@/i18n';
import { MOTION_SMOOTH_SPRING } from '@/lib/ui-motion';

const props = defineProps<{
  activeKey: string;
  bottomGap: number;
  hasUnread: boolean;
  items: AppNavigationItem[];
  photoUrl: string | null;
  profileActive: boolean;
  userName: string;
}>();
const { t } = useI18n();
const itemCount = computed(() => props.items.length + 2);
const activeIndex = computed(() => {
  const primaryIndex = props.items.findIndex((item) => item.isActive);
  if (primaryIndex >= 0) return primaryIndex;
  if (props.activeKey === 'notifications') return props.items.length;
  if (props.profileActive) return props.items.length + 1;
  return -1;
});

defineEmits<{
  navigate: [isActive: boolean];
}>();
</script>
