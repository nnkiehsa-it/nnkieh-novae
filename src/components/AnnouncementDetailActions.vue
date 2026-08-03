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
      :disabled="commentsToggleBusy"
      :label="announcement.comments_enabled ? 'comments.closeNewComments' : 'comments.reopenNewComments'"
      :compact="compact"
      :title="announcement.comments_enabled ? 'comments.closeNewComments' : 'comments.reopenNewComments'"
      :aria-label="announcement.comments_enabled ? 'comments.closeNewComments' : 'comments.reopenNewComments'"
      @click="emit('toggleComments')"
    >
      <AppIcon name="comment" />
    </DetailActionButton>
  </DetailActionGroup>
</template>

<script setup lang="ts">
import DetailActionButton from '@/components/ui/molecules/DetailActionButton.vue';
import DetailActionGroup from '@/components/ui/molecules/DetailActionGroup.vue';
import AppIcon from '@/components/ui/atoms/AppIcon.vue';
import type { AnnouncementRecord } from '@/types';

defineProps<{
  announcement: AnnouncementRecord;
  canManage: boolean;
  commentsToggleBusy: boolean;
  compact?: boolean;
  liking: boolean;
}>();

const emit = defineEmits<{
  delete: [];
  share: [];
  toggleLike: [];
  toggleComments: [];
}>();
</script>
