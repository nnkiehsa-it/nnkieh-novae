<template>
  <aside
    class="app-sidebar fixed inset-y-0 left-0 z-40 hidden flex-col border-0 bg-surface/94 py-4 shadow-elevated backdrop-blur-xl dark:bg-surface/94 md:flex"
    aria-label="桌面主要導覽"
    @click="handleSidebarClick"
  >
    <div class="app-sidebar__header">
      <RouterLink
        :to="homeRoute"
        class="app-sidebar__brand"
        aria-label="Novae 提案首頁"
      >
        <BrandMark />
        <span class="app-sidebar__brand-label">Novae</span>
      </RouterLink>
      <button
        type="button"
        class="app-sidebar__toggle"
        :aria-label="expanded ? '收合側邊導覽' : '展開側邊導覽'"
        :title="expanded ? '收合側邊導覽' : '展開側邊導覽'"
        :aria-expanded="expanded"
        @click.stop="$emit('toggle')"
      >
        <AppIcon :name="expanded ? 'chevron-left' : 'chevron-right'" :size="3.5" />
      </button>
    </div>

    <nav class="mt-7 flex w-full flex-1 flex-col gap-2 px-3" aria-label="主要功能">
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

      <CreateActionMenu
        :can-create-announcement="isAdmin"
        :default-category="defaultCategory"
        :default-kind="defaultKind"
        @create-announcement="$emit('create-announcement')"
        @create-issue="category => $emit('create-issue', category)"
      >
        <template #trigger="{ open }">
          <button type="button" class="app-sidebar__item" aria-label="新增" data-label="新增" @click="open">
            <AppIcon name="plus" :size="5.5" :stroke-width="2.4" />
            <span class="app-sidebar__label">新增</span>
          </button>
        </template>
      </CreateActionMenu>

      <RouterLink
        to="/notifications"
        class="app-sidebar__item"
        :class="{ 'app-sidebar__item--active': notificationsActive }"
        :aria-label="hasUnread ? '通知，有新通知' : '通知'"
        data-label="通知"
      >
        <span class="relative inline-flex" aria-hidden="true">
          <AppIcon name="bell" :size="5" :stroke-width="1.9" />
          <span v-if="hasUnread" class="app-sidebar__badge"></span>
        </span>
        <span class="app-sidebar__label">通知</span>
      </RouterLink>
    </nav>

    <RouterLink
      to="/settings"
      class="app-sidebar__profile"
      :class="{ 'app-sidebar__item--active': profileActive }"
      aria-label="我的"
      data-label="我的"
    >
      <UserAvatar :photo-url="photoUrl" :name="userName" size="sm" alt-text="使用者頭像" class="!h-8 !w-8 rounded-full" />
      <span class="app-sidebar__profile-copy">
        <strong>{{ userName }}</strong>
        <span>{{ schoolLabel }}</span>
      </span>
    </RouterLink>
  </aside>
</template>

<script setup lang="ts">
import { RouterLink, type RouteLocationRaw } from 'vue-router';
import CreateActionMenu from '@/components/CreateActionMenu.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import BrandMark from '@/components/ui/BrandMark.vue';
import UserAvatar from '@/components/ui/UserAvatar.vue';
import type { IssueCategory } from '@/types';
import type { AppNavigationItem } from './types';

defineProps<{
  defaultCategory: IssueCategory;
  defaultKind: 'announcement' | 'issue';
  expanded: boolean;
  hasUnread: boolean;
  homeRoute: RouteLocationRaw;
  isAdmin: boolean;
  items: AppNavigationItem[];
  notificationsActive: boolean;
  photoUrl: string | null;
  profileActive: boolean;
  schoolLabel: string;
  userName: string;
}>();

const emit = defineEmits<{
  'create-announcement': [];
  'create-issue': [category: IssueCategory];
  navigate: [isActive: boolean];
  'navigate-link': [];
  toggle: [];
}>();

function handleSidebarClick(event: MouseEvent) {
  if (event.target instanceof Element && event.target.closest('a[href]')) emit('navigate-link');
}
</script>
