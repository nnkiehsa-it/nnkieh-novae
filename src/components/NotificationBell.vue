<template>
  <div ref="rootRef" class="relative">
    <button
      ref="triggerRef"
      type="button"
      :class="triggerClasses"
      :aria-label="triggerAriaLabel"
      :aria-expanded="isOpen"
      aria-controls="notification-panel"
      @click="togglePanel"
    >
      <span class="relative inline-flex">
        <AppIcon name="bell" :class="iconClass" :stroke-width="1.8" />
        <span
          v-if="badgeHasUnread"
          class="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-error dark:border-ink-900"
          :class="badgeClass"
          aria-label="有新通知"
        ></span>
      </span>
      <span v-if="label" class="app-bottom-nav__label">{{ label }}</span>
    </button>

    <Teleport to="body">
      <transition name="notification-panel">
        <section
          v-if="isOpen"
          id="notification-panel"
          ref="panelRef"
          class="popover-panel fixed z-50 flex h-auto max-h-[min(70dvh,38rem)] w-96 origin-top-right flex-col overflow-hidden rounded-3xl border-ink-200/90 bg-white/98 shadow-2xl dark:border-ink-700/80 dark:bg-ink-900/98"
          :style="panelPositionStyle"
          role="region"
          aria-label="通知中心"
          tabindex="-1"
        >
          <header class="flex shrink-0 items-start justify-between gap-4 border-b border-ink-100 px-5 py-4 dark:border-ink-800">
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-base font-bold tracking-tight text-ink-950 dark:text-ink-50">通知中心</h2>
                <span
                  v-if="badgeHasUnread"
                  class="rounded-full bg-error-container px-2 py-0.5 text-[11px] font-semibold text-on-error-container"
                >
                  有新通知
                </span>
              </div>
              <p class="mt-1 text-xs text-ink-500 dark:text-ink-400">查看提案、公告與留言的最新動態</p>
            </div>
            <button
              type="button"
              class="button-toolbar -mr-1 h-9 w-9 shrink-0 rounded-full p-0"
              aria-label="關閉通知"
              data-autofocus
              @click="closePanel"
            >
              <AppIcon name="close" :size="4.5" />
            </button>
          </header>

          <div v-if="loading" class="flex flex-1 items-center justify-center py-10" aria-label="通知載入中" aria-busy="true">
            <LoadingSpinner :size="6" />
          </div>

          <div v-else-if="error" class="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
            <AppIcon name="circle-alert" :size="8" class="text-error" />
            <p class="mt-3 text-sm font-semibold text-ink-900 dark:text-ink-100">通知暫時無法載入</p>
            <p class="mt-1 text-xs leading-5 text-ink-500 dark:text-ink-400">{{ error }}</p>
            <button type="button" class="button-secondary mt-4 h-9 px-4 text-xs font-semibold" @click.stop="retryNotifications">
              重新整理
            </button>
          </div>

          <div v-else-if="notifications.length === 0" class="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
            <span class="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink-100 text-ink-400 dark:bg-ink-800 dark:text-ink-500" aria-hidden="true">
              <AppIcon name="bell" :size="6" />
            </span>
            <p class="mt-4 text-sm font-semibold text-ink-900 dark:text-ink-100">目前沒有通知</p>
            <p class="mt-1 text-xs leading-5 text-ink-500 dark:text-ink-400">新的提案進度與互動會顯示在這裡</p>
          </div>

          <div v-else class="min-h-0 overflow-y-auto overscroll-contain">
            <button
              v-for="notification in notifications"
              :key="notification.id"
              type="button"
              class="relative flex min-h-[92px] w-full items-start gap-3 border-b border-ink-100 px-5 py-4 text-left transition-colors hover:bg-ink-50 focus-visible:bg-ink-50 dark:border-ink-800/60 dark:hover:bg-ink-800/50 dark:focus-visible:bg-ink-800/50"
              @click.stop="openNotification(notification)"
            >
              <AuthorAvatar
                v-if="isCommentNotification(notification)"
                :author-uid="notification.actor_uid"
                :photo-url="notification.actor_photo_url ?? null"
                :name="notification.actor_name ?? '留言者'"
                size="sm"
                :alt-text="`${notification.actor_name ?? '留言者'} 的頭像`"
                class="mt-0.5 shrink-0"
              />
              <span
                v-else
                class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                :class="notificationIconClass(notification)"
                aria-hidden="true"
              >
                <AppIcon :name="notificationIcon(notification)" :size="5" />
              </span>

              <span class="min-w-0 flex-1">
                <span class="flex items-start justify-between gap-3">
                  <span class="line-clamp-2 text-sm font-semibold leading-5 text-ink-950 dark:text-ink-50">
                    {{ notificationTitle(notification) }}
                  </span>
                  <span v-if="!notification.is_read" class="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-secondary" aria-label="未讀"></span>
                </span>
                <span class="mt-0.5 line-clamp-2 text-xs leading-5 text-ink-600 dark:text-ink-300">
                  {{ notificationBody(notification) }}
                </span>
                <span class="mt-1.5 block text-[11px] font-medium text-ink-400 dark:text-ink-500">
                  {{ formatDate(notification.created_at) }}
                </span>
              </span>

              <AppIcon name="chevron-right" :size="4" class="mt-7 shrink-0 text-ink-300 dark:text-ink-600" />
            </button>

            <div v-if="hasMore" class="px-5 pb-4 pt-3">
              <button
                type="button"
                class="button-secondary h-10 w-full text-xs font-semibold"
                :disabled="loadingMore"
                @click.stop="loadMoreNotifications"
              >
                {{ loadingMore ? '載入中...' : '載入較早的通知' }}
              </button>
            </div>
          </div>
        </section>
      </transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, type CSSProperties } from 'vue';
import AuthorAvatar from '@/components/AuthorAvatar.vue';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';
import AppIcon, { type AppIconName } from '@/components/ui/AppIcon.vue';
import { useClickOutside } from '@/composables/useClickOutside';
import { useNotificationNavigation } from '@/composables/useNotificationNavigation';
import { useNotifications } from '@/composables/useNotifications';
import { useNotificationBadge } from '@/composables/useNotificationBadge';
import { formatDate } from '@/lib/format';
import type { NotificationRecord } from '@/types';

const props = withDefaults(defineProps<{
  badgeClass?: string;
  iconClass?: string;
  label?: string;
  triggerActiveClass?: string;
  triggerClass?: string;
}>(), {
  badgeClass: '',
  iconClass: 'h-5 w-5',
  label: '',
  triggerActiveClass: 'button-toolbar--active',
  triggerClass: 'button-toolbar relative h-10 w-10 rounded-full p-0',
});

const { openNotificationTarget } = useNotificationNavigation();
const {
  notifications,
  hasMore,
  loading,
  loadingMore,
  error,
  openNotifications,
  loadMoreNotifications,
  retryNotifications,
  initializeNotifications,
} = useNotifications();
const { hasUnread: badgeHasUnread } = useNotificationBadge();

const isOpen = ref(false);
const rootRef = ref<HTMLElement | null>(null);
const triggerRef = ref<HTMLButtonElement | null>(null);
const panelRef = ref<HTMLElement | null>(null);
const panelPositionStyle = ref<CSSProperties>({});
const triggerClasses = computed(() => [
  props.triggerClass,
  { [props.triggerActiveClass]: isOpen.value && Boolean(props.triggerActiveClass) },
]);
const triggerAriaLabel = computed(() => badgeHasUnread.value ? '通知，有新通知' : '通知');

async function togglePanel() {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    initializeNotifications();
    await nextTick();
    updatePanelPosition();
    await openNotifications();
  }
}

function updatePanelPosition() {
  if (!triggerRef.value) {
    panelPositionStyle.value = {};
    return;
  }

  const triggerRect = triggerRef.value.getBoundingClientRect();
  panelPositionStyle.value = {
    right: `${Math.max(16, window.innerWidth - triggerRect.right)}px`,
    top: `${triggerRect.bottom + 8}px`,
  };
}
function notificationTitle(notification: NotificationRecord) {
  return notification.title;
}

function notificationBody(notification: NotificationRecord) {
  return notification.body_preview || '';
}

function notificationIcon(notification: NotificationRecord): AppIconName {
  if (notification.type === 'announcement_created') return 'megaphone';
  if (notification.type === 'issue_created') return 'plus';
  if (notification.type === 'support_goal_met') return 'check-circle';
  if (notification.type === 'issue_deleted') return 'trash';
  return 'switch-horizontal';
}

function notificationIconClass(notification: NotificationRecord) {
  if (notification.type === 'announcement_created') return 'bg-secondary-container text-on-secondary-container';
  if (notification.type === 'support_goal_met') return 'bg-primary-container text-on-primary-container';
  if (notification.type === 'issue_deleted') return 'bg-error-container text-on-error-container';
  if (notification.type === 'issue_status_changed' && (notification.new_status === 'infeasible' || notification.new_status === 'auto-rejected' || notification.new_status === 'review-rejected')) {
    return 'bg-warning-container text-on-warning-container';
  }
  return 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300';
}

function isCommentNotification(notification: NotificationRecord) {
  return notification.type === 'announcement_comment_created' || notification.type === 'issue_comment_created';
}

function closePanel() {
  isOpen.value = false;
}

useClickOutside(isOpen, [rootRef, panelRef], closePanel, { escape: true });

function openNotification(notification: NotificationRecord) {
  closePanel();
  void openNotificationTarget(notification);
}

onMounted(() => {
  window.addEventListener('resize', updatePanelPosition);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', updatePanelPosition);
});
</script>
