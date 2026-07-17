<template>
  <section class="route-page page-bottom-safe min-h-0 flex-1 py-2">
    <div class="min-h-0 flex-1">
      <div :key="notificationPanelKey">
        <SurfacePanel v-if="loading" variant="list" :aria-label="t('notification.notificationsLoading')">
          <div
            v-for="index in 4"
            :key="index"
            class="notification-group-row list-surface-row"
          >
            <div class="h-10 w-10 shrink-0 rounded-2xl bg-ink-100/60 dark:bg-ink-800 animate-skeleton"></div>
            <div class="min-w-0 flex-1 space-y-2 pt-1">
              <div class="h-3 w-2/3 rounded-full bg-ink-100/60 dark:bg-ink-800 animate-skeleton"></div>
              <div class="h-3 w-full rounded-full bg-ink-100/60 dark:bg-ink-800 animate-skeleton"></div>
              <div class="h-2.5 w-1/3 rounded-full bg-ink-100/60 dark:bg-ink-800 animate-skeleton"></div>
            </div>
          </div>
        </SurfacePanel>

        <SurfacePanel v-else-if="error && notifications.length === 0" variant="list" class="flex flex-col items-center justify-center px-6 py-10 text-center">
          <AppIcon name="circle-alert" :size="8" class="text-error" />
          <p class="mt-3 text-sm font-semibold text-ink-900 dark:text-ink-100">{{ t('notification.failedToLoadNotifications') }}</p>
          <p class="mt-1 text-xs leading-5 text-ink-500 dark:text-ink-400">{{ t(error) }}</p>
          <button type="button" class="button-secondary mt-4 h-9 px-4 text-xs font-semibold" @click.stop="retryNotifications">
            {{ t('dashboard.refresh') }}
          </button>
        </SurfacePanel>

        <SurfacePanel v-else-if="notifications.length === 0" variant="list" class="flex flex-col items-center justify-center px-6 py-12 text-center">
          <span class="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink-100 text-ink-400 dark:bg-ink-800 dark:text-ink-500" aria-hidden="true">
            <AppIcon name="bell" :size="6" />
          </span>
          <p class="mt-4 text-sm font-semibold text-ink-900 dark:text-ink-100">{{ t('notification.noNotificationsYet') }}</p>
          <p class="mt-1 text-xs leading-5 text-ink-500 dark:text-ink-400">{{ t('notification.newActivityWillAppearHere') }}</p>
        </SurfacePanel>

        <SurfacePanel v-else variant="list">
          <button
            v-for="notification in notifications"
            :key="notification.id"
            type="button"
            class="notification-group-row list-surface-row list-surface-row--interactive"
            @click.stop="openNotification(notification)"
          >
            <AuthorAvatar
              v-if="isComment(notification)"
              :author-uid="notification.actor_uid"
              :photo-url="notification.actor_photo_url ?? null"
              :name="notification.actor_name ?? t('navigation.user')"
              size="sm"
              :alt-text="t('notification.nameAvatar', { name: notification.actor_name ?? t('navigation.user') })"
              class="mt-0.5 shrink-0"
            />
            <span
              v-else
              class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              :class="iconClass(notification)"
              aria-hidden="true"
            >
              <AppIcon :name="icon(notification)" :size="5" />
            </span>

            <span class="min-w-0 flex-1">
              <span class="flex items-start justify-between gap-3">
                <span class="line-clamp-2 text-sm font-semibold leading-5 text-ink-950 dark:text-ink-55">
                  {{ title(notification) }}
                </span>
                <span v-if="!notification.is_read" class="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-info" :aria-label="t('notification.unread')"></span>
              </span>
              <span class="mt-0.5 line-clamp-2 text-xs leading-5 text-ink-600 dark:text-ink-300">
                {{ body(notification) }}
              </span>
              <span class="mt-1.5 block text-[11px] font-medium text-ink-400 dark:text-ink-500">
                {{ formatDate(notification.created_at) }}
              </span>
            </span>

            <AppIcon name="chevron-right" :size="4" class="mt-7 shrink-0 text-ink-300 dark:text-ink-600" />
          </button>

          <div
            v-if="loadingMore"
            class="notification-group-row list-surface-row border-t border-ink-100/70 dark:border-ink-800/70"
          >
            <div class="h-10 w-10 shrink-0 rounded-2xl bg-ink-100/60 dark:bg-ink-800 animate-skeleton"></div>
            <div class="min-w-0 flex-1 space-y-2 pt-1">
              <div class="h-3 w-2/3 rounded-full bg-ink-100/60 dark:bg-ink-800 animate-skeleton"></div>
              <div class="h-3 w-full rounded-full bg-ink-100/60 dark:bg-ink-800 animate-skeleton"></div>
              <div class="h-2.5 w-1/3 rounded-full bg-ink-100/60 dark:bg-ink-800 animate-skeleton"></div>
            </div>
          </div>

          <FeedLoadMoreControl
            v-show="!loadingMore"
            class="bg-white dark:bg-surface"
            :has-more="hasMore"
            :loading="loadingMore"
            :error="Boolean(error)"
            @load-more="loadMoreNotifications"
          />
          <div v-if="hasMore" ref="loadMoreSentinel" class="h-1" aria-hidden="true"></div>
        </SurfacePanel>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import AuthorAvatar from '@/components/AuthorAvatar.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import SurfacePanel from '@/components/ui/SurfacePanel.vue';
import FeedLoadMoreControl from '@/components/ui/FeedLoadMoreControl.vue';
import { useInfiniteScroll } from '@/composables/useInfiniteScroll';
import { useNotificationNavigation } from '@/composables/useNotificationNavigation';
import { useNotificationDisplay } from '@/composables/useNotificationDisplay';
import { useNotifications } from '@/composables/useNotifications';
import { formatDate } from '@/lib/format';
import type { NotificationRecord } from '@/types';
import { useI18n } from '@/i18n';

const { openNotificationTarget } = useNotificationNavigation();
const { body, icon, iconClass, isComment, title } = useNotificationDisplay();
const { t } = useI18n();
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

const infiniteScrollDisabled = computed(() =>
  loading.value || loadingMore.value || Boolean(error.value) || !hasMore.value
);
const { sentinel: loadMoreSentinel } = useInfiniteScroll({
  disabled: infiniteScrollDisabled,
  onLoadMore: loadMoreNotifications,
});

const notificationPanelKey = computed(() => {
  if (loading.value) return 'loading';
  if (error.value && notifications.value.length === 0) return 'error';
  if (notifications.value.length === 0) return 'empty';
  return 'list';
});

onMounted(() => {
  void openNotifications();
});

function openNotification(notification: NotificationRecord) {
  void openNotificationTarget(notification);
}
</script>
