<template>
  <nav
    class="app-bottom-nav fixed left-4 right-4 z-40 mx-auto max-w-md rounded-full border-0 bg-surface/94 px-3 py-1.5 shadow-floating backdrop-blur-xl dark:bg-surface/94 md:hidden"
    :style="{ bottom: `${bottomGap}px` }"
    aria-label="手機主要導覽"
  >
    <div ref="navRef" class="app-bottom-nav__inner relative mx-auto grid grid-cols-5 gap-1">
      <div
        class="pointer-events-none absolute rounded-full bg-ink-100/90 shadow-note dark:bg-ink-800/80"
        :style="[indicatorStyle, { transition: 'all 280ms cubic-bezier(0.16, 1, 0.3, 1)' }]"
      ></div>

      <RouterLink
        v-for="item in items"
        :key="item.key"
        :ref="element => setNavElement(item.key, element)"
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

      <CreateActionMenu
        :can-create-announcement="isAdmin"
        :default-category="defaultCategory"
        :default-kind="defaultKind"
        @create-announcement="$emit('create-announcement')"
        @create-issue="category => $emit('create-issue', category)"
      >
        <template #trigger="{ open }">
          <button
            :ref="element => setNavElement('create', element)"
            type="button"
            class="app-bottom-nav__item"
            title="新增"
            aria-label="新增"
            @click="open"
          >
            <span class="app-bottom-nav__icon" aria-hidden="true">
              <AppIcon name="plus" :size="5" :stroke-width="2.4" />
            </span>
          </button>
        </template>
      </CreateActionMenu>

      <RouterLink
        :ref="element => setNavElement('notifications', element)"
        to="/notifications"
        class="app-bottom-nav__item"
        :class="{ 'app-bottom-nav__item--active': notificationsActive }"
      >
        <span class="app-bottom-nav__icon relative inline-flex" aria-hidden="true">
          <AppIcon name="bell" :size="4.5" :stroke-width="1.9" />
          <span
            v-if="hasUnread"
            class="app-bottom-nav__badge absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-error dark:border-ink-900"
            aria-label="有新通知"
          ></span>
        </span>
        <span class="app-bottom-nav__label">通知</span>
      </RouterLink>

      <RouterLink
        :ref="element => setNavElement('settings', element)"
        to="/settings"
        class="app-bottom-nav__item overflow-visible"
        :class="{ 'app-bottom-nav__item--active': profileActive }"
      >
        <span class="app-bottom-nav__icon overflow-hidden rounded-full" aria-hidden="true">
          <UserAvatar :photo-url="photoUrl" :name="userName" size="sm" alt-text="使用者頭像" class="!h-5 !w-5 rounded-full" />
        </span>
        <span class="app-bottom-nav__label">我的</span>
      </RouterLink>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import CreateActionMenu from '@/components/CreateActionMenu.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import UserAvatar from '@/components/ui/UserAvatar.vue';
import type { IssueCategory } from '@/types';
import type { AppNavigationItem } from './types';

const props = defineProps<{
  activeKey: string;
  bottomGap: number;
  defaultCategory: IssueCategory;
  defaultKind: 'announcement' | 'issue';
  hasUnread: boolean;
  isAdmin: boolean;
  items: AppNavigationItem[];
  notificationsActive: boolean;
  photoUrl: string | null;
  profileActive: boolean;
  userName: string;
}>();

defineEmits<{
  'create-announcement': [];
  'create-issue': [category: IssueCategory];
  navigate: [isActive: boolean];
}>();

const navRef = ref<HTMLDivElement | null>(null);
const navElements = new Map<string, HTMLElement>();
const indicatorStyle = ref({ height: '0px', left: '0px', top: '0px', width: '0px' });

function resolveElement(element: Element | { $el?: Element } | null) {
  if (!element) return null;
  return '$el' in element ? element.$el ?? null : element;
}

function setNavElement(key: string, element: Element | { $el?: Element } | null) {
  const resolved = resolveElement(element);
  if (resolved instanceof HTMLElement) navElements.set(key, resolved);
  else navElements.delete(key);
}

async function updateIndicator() {
  await nextTick();
  const activeElement = navElements.get(props.activeKey);
  if (!activeElement || !navRef.value) {
    indicatorStyle.value = { height: '0px', left: '0px', top: '0px', width: '0px' };
    return;
  }
  const navRect = navRef.value.getBoundingClientRect();
  const itemRect = activeElement.getBoundingClientRect();
  indicatorStyle.value = {
    height: `${itemRect.height}px`,
    left: `${itemRect.left - navRect.left}px`,
    top: `${itemRect.top - navRect.top}px`,
    width: `${itemRect.width}px`,
  };
}

watch(() => props.activeKey, updateIndicator, { immediate: true });

onMounted(() => {
  window.addEventListener('resize', updateIndicator);
  window.setTimeout(updateIndicator, 100);
});

onBeforeUnmount(() => window.removeEventListener('resize', updateIndicator));
</script>
