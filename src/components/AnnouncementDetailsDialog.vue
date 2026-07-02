<template>
  <DetailDialogShell
    v-if="announcement"
    close-label="關閉公告"
    :initial-tab="initialTab"
    :open="true"
    details-label="公告內容"
    @close="emit('close')"
  >
    <template #header>
      <span class="tag border-ink-200 bg-ink-100/50 dark:border-ink-800 dark:bg-ink-950/50">公告</span>
    </template>

    <template #details="{ compact, scrollContent }">
      <AnnouncementDetailContent
        :announcement="announcement"
        :compact="compact"
        :scroll-content="scrollContent"
      />
    </template>

    <template #actions>
      <AnnouncementDetailActions
        :announcement="announcement"
        :can-manage="canManage"
        :liking="liking"
        @delete="emit('delete')"
        @edit="emit('edit')"
        @share="emit('share')"
        @toggle-like="emit('toggleLike')"
      />
    </template>

    <template #comments="{ compactHeader }">
      <AnnouncementComments
        :announcement-id="announcement.id"
        :compact-header="compactHeader"
        class="h-full"
        @comment-count-changed="emit('commentCountChanged', $event)"
        @content-unavailable="emit('contentUnavailable', $event)"
      />
    </template>
  </DetailDialogShell>
</template>

<script setup lang="ts">
import type { AnnouncementRecord } from '@/types';
import AnnouncementComments from '@/components/AnnouncementComments.vue';
import AnnouncementDetailActions from '@/components/AnnouncementDetailActions.vue';
import AnnouncementDetailContent from '@/components/AnnouncementDetailContent.vue';
import DetailDialogShell from '@/components/ui/DetailDialogShell.vue';

const props = defineProps<{
  announcement: AnnouncementRecord | null;
  canManage: boolean;
  initialTab?: 'details' | 'comments';
  liking: boolean;
}>();

const emit = defineEmits<{
  close: [];
  contentUnavailable: [announcementId: string];
  share: [];
  delete: [];
  edit: [];
  toggleLike: [];
  commentCountChanged: [payload: { announcementId: string; commentCount: number }];
}>();
</script>
