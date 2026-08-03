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

    <DetailActionButton
      v-if="canManage"
      :disabled="commentsToggleBusy || (!announcement.comments_enabled && !announcement.comments_globally_enabled)"
      :label="commentsActionLabel"
      :compact="compact"
      :title="commentsActionLabel"
      :aria-label="commentsActionLabel"
      @click="emit('toggleComments')"
    >
      <AppIcon name="comment" />
    </DetailActionButton>
  </DetailActionGroup>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import DetailActionButton from '@/components/ui/molecules/DetailActionButton.vue';
import DetailActionGroup from '@/components/ui/molecules/DetailActionGroup.vue';
import AppIcon from '@/components/ui/atoms/AppIcon.vue';
import type { AnnouncementRecord } from '@/types';

const props = defineProps<{
  announcement: AnnouncementRecord;
  canManage: boolean;
  commentsToggleBusy: boolean;
  compact?: boolean;
  liking: boolean;
}>();

const commentsActionLabel = computed(() => {
  if (!props.announcement.comments_enabled && !props.announcement.comments_globally_enabled) {
    return 'comments.closedByGlobalSetting';
  }
  return props.announcement.comments_enabled
    ? 'comments.closeNewComments'
    : 'comments.reopenNewComments';
});

const emit = defineEmits<{
  delete: [];
  share: [];
  toggleLike: [];
  toggleComments: [];
}>();
</script>
