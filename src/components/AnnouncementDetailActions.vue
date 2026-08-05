<template>
  <DetailActionGroup
    :compact="compact"
    delete-title="announcement.deleteAnnouncement"
    :show-delete="canManage"
    @delete="emit('delete')"
    @share="emit('share')"
  >
    <template #primary>
      <DetailActionButton
        :active="announcement.currentUserLiked"
        :disabled="liking"
        :label="String(announcement.like_count)"
        :compact="compact"
        :title="announcement.currentUserLiked ? 'announcement.removeLike' : 'announcement.unlikeAnnouncement'"
        :aria-label="announcement.currentUserLiked ? 'announcement.removeLike' : 'announcement.unlikeAnnouncement'"
        @click="emit('toggleLike')"
      >
        <AppIcon name="thumbs-up" />
      </DetailActionButton>
    </template>
  </DetailActionGroup>
</template>

<script setup lang="ts">
import DetailActionButton from '@/components/ui/molecules/DetailActionButton.vue';
import DetailActionGroup from '@/components/ui/molecules/DetailActionGroup.vue';
import AppIcon from '@/components/ui/atoms/AppIcon.vue';
import type { AnnouncementRecord } from '@/types';

const props = defineProps<{
  announcement: AnnouncementRecord;
  canManage: boolean;
  compact?: boolean;
  liking: boolean;
}>();

const emit = defineEmits<{
  delete: [];
  share: [];
  toggleLike: [];
}>();
</script>
