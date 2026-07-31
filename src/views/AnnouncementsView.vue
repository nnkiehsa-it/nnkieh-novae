<template>
  <RoutePageFrame layout="fill">
    <div ref="announcementScrollRef" class="route-scroll-through scroll-shadow-space scrollbar-subtle min-h-0 flex-1 space-y-5 overflow-auto overscroll-contain">
      <div class="flex items-center justify-end gap-3 md:justify-between">
        <h2 class="hidden shrink-0 text-2xl font-semibold tracking-[0.015em] text-ink-950 dark:text-ink-50 md:block">{{ t('announcement.announcement') }}</h2>
        <AppButton
          v-if="isAdmin"
          variant="contextual"
          class="h-8 w-8 min-w-8 shrink-0 p-0"
          :aria-label="t('announcement.newAnnouncement')"
          :title="t('announcement.newAnnouncement')"
          @click="openComposer"
        >
          <AppIcon name="plus" :size="4" />
        </AppButton>
      </div>

      <ContentListState
        :empty="announcements.length === 0"
        empty-description="announcement.emptyDescription"
        empty-icon="chart"
        empty-title="announcement.thereAreCurrentlyNoAnnouncements"
        :error="error"
        error-title="announcement.announcementReadingFailed"
        :has-more="hasMore"
        :loading="visibleAnnouncementLoading"
        :loading-has-problem="announcementLoadingHasProblem"
        :loading-more="loadingMore"
        :panel-key="announcementPanelKey"
        :problem-description="announcementProblemDescription"
        :problem-title="announcementProblemTitle"
        :retry-disabled="!announcementOnline"
        spacing-class="space-y-3"
        :unavailable="!isAllowedUser"
        unavailable-description="announcement.pleaseLogInWithYourSchoolAccountFirst"
        unavailable-title="announcement.unableToViewAnnouncements"
        @load-more="loadMoreAnnouncements"
        @retry="retryAnnouncements"
      >
        <template #loading>
          <AnnouncementTable
            :announcements="[]"
            :loading="true"
          />
        </template>

        <template #loading-more>
          <AnnouncementTable
            :announcements="[]"
            :loading="true"
            :loading-count="1"
          />
        </template>

        <AnnouncementTable
          :announcements="announcements"
          :liking-announcement-id="likingAnnouncementId"
          @open="openAnnouncementDetails"
          @open-comments="(announcement) => openAnnouncementDetails(announcement, 'comments')"
          @toggle-like="handleToggleLike"
        />

        <template #sentinel>
          <div ref="loadMoreSentinel" class="h-1" aria-hidden="true"></div>
        </template>
      </ContentListState>
    </div>
  </RoutePageFrame>
</template>

<script setup lang="ts">
import RoutePageFrame from '@/components/ui/organisms/RoutePageFrame.vue';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import AnnouncementTable from '@/components/AnnouncementTable.vue';
import AppIcon from '@/components/ui/atoms/AppIcon.vue';
import AppButton from '@/components/ui/atoms/AppButton.vue';
import ContentListState from '@/components/ui/organisms/ContentListState.vue';
import { useAnnouncementManagement } from '@/composables/useAnnouncementManagement';
import { useContentListRuntime } from '@/composables/useContentListRuntime';
import { useI18n } from '@/i18n';

const {
  announcements,
  loading,
  loadingMore,
  error,
  hasMore,
  loadMoreAnnouncements,
  refreshAnnouncements,
  likingAnnouncementId,
  sessionLoading,
  isAdmin,
  isAllowedUser,
  openAnnouncementDetails,
  handleToggleLike,
} = useAnnouncementManagement();

const { t } = useI18n();
const router = useRouter();
const announcementScrollRef = ref<HTMLElement | null>(null);
const rawAnnouncementLoading = computed(() => sessionLoading.value || loading.value);
const announcementPanelKey = 'announcements';
const {
  isOnline: announcementOnline,
  loadMoreSentinel,
  loadingHasProblem: announcementLoadingHasProblem,
  problemDescription: announcementProblemDescription,
  problemTitle: announcementProblemTitle,
  retry: retryAnnouncements,
  visibleLoading: visibleAnnouncementLoading,
} = useContentListRuntime({
  canLoad: isAllowedUser,
  error,
  hasMore,
  loadMore: loadMoreAnnouncements,
  loading: rawAnnouncementLoading,
  loadingMore,
  refresh: refreshAnnouncements,
  scrollRoot: announcementScrollRef,
  refreshFeedback: {
    error: 'announcement.updateFailed',
    loading: 'announcement.announcementIsBeingUpdated',
    success: 'announcement.announcementHasBeenUpdated',
  },
});

function openComposer() {
  void router.push({ name: 'announcement-create' });
}
</script>
