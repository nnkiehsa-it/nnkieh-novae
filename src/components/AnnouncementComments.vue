<template>
  <CommentThreadPanel
    :can-delete-comment="canDeleteThreadComment"
    :can-compose="canCompose"
    :comments="comments"
    :embedded="embedded"
    :mobile-docked="embedded"
    :deleting-id="deletingId"
    :error="error"
    :loaded="loaded"
    :loading="loading"
    :focus-comment-id="focusCommentId"
    :has-more="hasMore"
    :loading-more="loadingMore"
    :load-more-error="loadMoreError"
    :on-load-more="loadMoreComments"
    :on-retry="loadComments"
    :on-delete-comment="deleteComment"
    :on-submit-comment="handleSubmit"
    :submit-error="error"
    :submitting="submitting"
    :target-id="announcementId"
  />
</template>

<script setup lang="ts">
import { watch } from 'vue';
import CommentThreadPanel from '@/components/CommentThreadPanel.vue';
import { useAnnouncementComments } from '@/composables/useAnnouncementComments';
import type { DiscussionCommentRecord } from '@/types';

const props = withDefaults(defineProps<{
  announcementId: string;
  canCompose?: boolean;
  embedded?: boolean;
  focusCommentId?: string;
}>(), {
  embedded: false,
  canCompose: true,
  focusCommentId: '',
});

const emit = defineEmits<{
  contentUnavailable: [announcementId: string];
}>();

const {
  canDeleteComment,
  comments,
  deletingId,
  error,
  loadComments,
  loadMoreComments,
  loadMoreError,
  hasMore,
  loaded,
  loading,
  loadingMore,
  submitComment,
  submitting,
  deleteComment,
  subscribeCurrentAnnouncementComments,
} = useAnnouncementComments(
  () => props.announcementId,
  (announcementId) => emit('contentUnavailable', announcementId),
);

async function handleSubmit(payload: { content: string; parentCommentId: string | null }) {
  return submitComment(payload.content, payload.parentCommentId);
}

function canDeleteThreadComment(comment: DiscussionCommentRecord) {
  return canDeleteComment(comment);
}

watch(
  () => props.announcementId,
  () => {
    subscribeCurrentAnnouncementComments();
    void loadComments();
  },
  { immediate: true },
);

</script>
