<template>
  <ContentCardCollection
    :empty="announcements.length === 0"
    empty-label="announcement.noAnnouncementsYet"
    list-label="announcement.announcementList"
    :loading="loading"
  >
    <template #loading>
      <ContentCardSkeleton
        :action-shapes="['icon', 'pill']"
        :count="loadingCount"
        loading-label="announcement.announcementLoading"
      />
    </template>

    <AnimatePresence mode="popLayout" :initial="false">
      <m.div
        v-for="announcement in announcements"
        :key="announcement.id"
        :data-content-id="announcement.id"
        layout
        :initial="{ opacity: 0, y: 16, scale: 0.985 }"
        :animate="{ opacity: 1, y: 0, scale: 1 }"
        :exit="{ opacity: 0, y: -10, scale: 0.985 }"
        :transition="listMotionTransition"
      >
        <AnnouncementTableRow
          :announcement="announcement"
          :liking="likingAnnouncementId === announcement.id"
          @open="emit('open', $event)"
          @open-comments="emit('openComments', $event)"
          @toggle-like="emit('toggleLike', $event)"
        />
      </m.div>
    </AnimatePresence>
  </ContentCardCollection>
</template>

<script setup lang="ts">
import AnnouncementTableRow from './AnnouncementTableRow.vue';
import ContentCardCollection from '@/components/ui/organisms/ContentCardCollection.vue';
import ContentCardSkeleton from '@/components/ui/organisms/ContentCardSkeleton.vue';
import { AnimatePresence, m } from 'motion-v';
import type { AnnouncementRecord } from '@/types';
import { MOTION_SMOOTH_SPRING, MOTION_SMOOTH_TWEEN } from '@/lib/ui-motion';

withDefaults(defineProps<{
  announcements: AnnouncementRecord[];
  likingAnnouncementId?: string;
  loading?: boolean;
  loadingCount?: number;
}>(), {
  likingAnnouncementId: '',
  loading: false,
  loadingCount: 2,
});

const emit = defineEmits<{
  open: [announcement: AnnouncementRecord];
  openComments: [announcement: AnnouncementRecord];
  toggleLike: [announcement: AnnouncementRecord];
}>();

const listMotionTransition = {
  layout: MOTION_SMOOTH_SPRING,
  opacity: MOTION_SMOOTH_TWEEN,
  scale: MOTION_SMOOTH_TWEEN,
  y: MOTION_SMOOTH_TWEEN,
};
</script>
