<template>
  <section class="page-workspace page-workspace--tall page-bottom-safe flex min-h-0 flex-1 flex-col">
    <header class="page-workspace__header hidden md:block">
      <h2 class="page-title">通知</h2>
      <p class="page-description mt-1">查看提案、公告與留言的最新動態</p>
    </header>
    <div class="page-workspace__body min-h-0 flex-1 overflow-y-auto pb-4">
      <Transition name="panel-switch" mode="out-in">
        <div :key="notificationPanelKey">
          <div v-if="loading" class="space-y-4 py-2" aria-label="通知載入中">
            <div
              v-for="index in 4"
              :key="index"
              class="flex items-start gap-3 border-b border-ink-100/60 dark:border-ink-800/40 last:border-0 pb-4"
            >
              <div class="h-10 w-10 shrink-0 rounded-2xl bg-ink-100 dark:bg-ink-800 animate-skeleton"></div>
              <div class="min-w-0 flex-1 space-y-2 pt-1">
                <div class="h-3 w-2/3 rounded-full bg-ink-100 dark:bg-ink-800 animate-skeleton"></div>
                <div class="h-3 w-full rounded-full bg-ink-100 dark:bg-ink-800 animate-skeleton"></div>
                <div class="h-2.5 w-1/3 rounded-full bg-ink-100 dark:bg-ink-800 animate-skeleton"></div>
              </div>
            </div>
          </div>

          <div v-else-if="error" class="flex flex-col items-center justify-center py-10 text-center">
            <AppIcon name="circle-alert" :size="8" class="text-error" />
            <p class="mt-3 text-sm font-semibold text-ink-900 dark:text-ink-100">通知暫時無法載入</p>
            <p class="mt-1 text-xs leading-5 text-ink-500 dark:text-ink-400">{{ error }}</p>
            <button type="button" class="button-secondary mt-4 h-9 px-4 text-xs font-semibold" @click.stop="retryNotifications">
              重新整理
            </button>
          </div>

          <div v-else-if="notifications.length === 0" class="flex flex-col items-center justify-center py-12 text-center">
            <span class="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink-100 text-ink-400 dark:bg-ink-800 dark:text-ink-500" aria-hidden="true">
              <AppIcon name="bell" :size="6" />
            </span>
            <p class="mt-4 text-sm font-semibold text-ink-900 dark:text-ink-100">目前沒有通知</p>
            <p class="mt-1 text-xs leading-5 text-ink-500 dark:text-ink-400">新的提案進度與互動會顯示在這裡</p>
          </div>

          <div v-else class="divide-y divide-ink-100 dark:divide-ink-800/60">
            <button
              v-for="notification in notifications"
              :key="notification.id"
              type="button"
              class="relative flex min-h-[92px] w-full items-start gap-3 px-1 py-4 text-left transition-colors hover:bg-ink-50 focus-visible:bg-ink-50 dark:hover:bg-ink-800/50 dark:focus-visible:bg-ink-800/50"
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

            <div v-if="hasMore" class="pt-4 pb-2">
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
        </div>
      </Transition>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import AuthorAvatar from '@/components/AuthorAvatar.vue';
import AppIcon, { type AppIconName } from '@/components/ui/AppIcon.vue';
import { useNotificationNavigation } from '@/composables/useNotificationNavigation';
import { useNotifications } from '@/composables/useNotifications';
import { formatDate } from '@/lib/format';
import type { NotificationRecord } from '@/types';

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
initializeNotifications();

const notificationPanelKey = computed(() => {
  if (loading.value) return 'loading';
  if (error.value) return 'error';
  if (notifications.value.length === 0) return 'empty';
  return 'list';
});

onMounted(async () => {
  await openNotifications();
});

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

function openNotification(notification: NotificationRecord) {
  void openNotificationTarget(notification);
}
</script>
