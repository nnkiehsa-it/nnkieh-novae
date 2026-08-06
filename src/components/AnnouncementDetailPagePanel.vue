<template>
  <ContentDetailPagePanel
    v-if="announcement"
    back-label="announcement.returnToAnnouncementList"
    :author-uid="announcement.author_uid"
    :content="announcement.content"
    details-label="announcement.announcementContent"
    :initial-tab="initialTab"
    :title="announcement.title"
    @back="emit('back')"
  >
    <template #header>
      <TagBadge class="border-ink-200 bg-ink-100/50 dark:border-ink-800 dark:bg-ink-950/50">{{ t('announcement.announcement') }}</TagBadge>
    </template>

    <template #actions="{ compact }">
      <AnnouncementDetailActions
        :announcement="announcement"
        :can-manage="canManage"
        :compact="compact"
        :liking="liking"
        @delete="emit('delete')"
        @share="emit('share')"
        @toggle-like="emit('toggleLike')"
      />
    </template>

    <template #comments="{ embedded }">
      <AnnouncementComments
        :announcement-id="announcement.id"
        :can-compose="announcement.comments_enabled"
        :embedded="embedded"
        :focus-comment-id="focusCommentId"
        class="h-full"
        @comment-count-changed="emit('commentCountChanged', $event)"
        @content-unavailable="emit('contentUnavailable', $event)"
      />
    </template>
  </ContentDetailPagePanel>
</template>

<script setup lang="ts">
import type { AnnouncementRecord } from '@/types';
import AnnouncementComments from '@/components/AnnouncementComments.vue';
import AnnouncementDetailActions from '@/components/AnnouncementDetailActions.vue';
import ContentDetailPagePanel from '@/components/ContentDetailPagePanel.vue';
import TagBadge from '@/components/ui/atoms/TagBadge.vue';
import { useI18n } from '@/i18n';

const { t } = useI18n();

const props = withDefaults(defineProps<{
  announcement: AnnouncementRecord | null;
  canManage: boolean;
  focusCommentId?: string;
  initialTab?: 'details' | 'comments';
  liking: boolean;
}>(), {
  focusCommentId: '',
  initialTab: 'details',
});

const emit = defineEmits<{
  back: [];
  commentCountChanged: [commentCount: number];
  contentUnavailable: [announcementId: string];
  share: [];
  delete: [];
  toggleLike: [];
}>();
</script>
