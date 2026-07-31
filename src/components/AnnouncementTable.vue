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

    <AnnouncementTableRow
      v-for="announcement in announcements"
      :key="announcement.id"
      :announcement="announcement"
      :liking="likingAnnouncementId === announcement.id"
      @open="emit('open', $event)"
      @open-comments="emit('openComments', $event)"
      @toggle-like="emit('toggleLike', $event)"
    />
  </ContentCardCollection>
</template>

<script setup lang="ts">
import AnnouncementTableRow from './AnnouncementTableRow.vue';
import ContentCardCollection from '@/components/ui/organisms/ContentCardCollection.vue';
import ContentCardSkeleton from '@/components/ui/organisms/ContentCardSkeleton.vue';
import type { AnnouncementRecord } from '@/types';

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
</script>
