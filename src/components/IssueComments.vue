<template>
  <CommentThreadPanel
    :can-delete-comment="canDeleteThreadComment"
    :can-compose="canCompose"
    :comments="accessible ? comments : []"
    :embedded="embedded"
    :mobile-docked="embedded"
    :deleting-id="deletingId"
    :error="accessible ? error : ''"
    :loaded="accessible ? loaded : true"
    :loading="accessible && loading"
    :focus-comment-id="focusCommentId"
    :has-more="accessible && hasMore"
    :loading-more="accessible && loadingMore"
    :load-more-error="accessible ? loadMoreError : ''"
    :on-load-more="loadMoreComments"
    :on-retry="loadComments"
    :on-delete-comment="deleteCommentById"
    :on-submit-comment="handleSubmitComment"
    :submit-error="submitError"
    :submitting="isSubmitting"
    :target-id="issueId"
  />
</template>

<script setup lang="ts">
import { toRef } from 'vue';
import CommentThreadPanel from '@/components/CommentThreadPanel.vue';
import { useIssueComments } from '@/composables/useIssueComments';
import type { DiscussionCommentRecord, IssueCategory } from '@/types';

const props = withDefaults(
  defineProps<{
    accessible?: boolean;
    canCompose?: boolean;
    focusCommentId?: string;
    issueId: string;
    category: IssueCategory;
    embedded?: boolean;
  }>(),
  {
    accessible: true,
    canCompose: true,
    embedded: false,
    focusCommentId: '',
  },
);

const emit = defineEmits<{
  contentUnavailable: [issueId: string];
}>();

const {
  canDeleteComment,
  comments,
  deleteCommentById,
  deletingId,
  error,
  isSubmitting,
  hasMore,
  loaded,
  loadMoreComments,
  loadMoreError,
  loadComments,
  loading,
  loadingMore,
  submitComment,
  submitError,
} = useIssueComments(
  toRef(props, 'issueId'),
  toRef(props, 'category'),
  (issueId) => emit('contentUnavailable', issueId),
  toRef(props, 'accessible'),
);

async function handleSubmitComment(payload: { content: string; parentCommentId: string | null }) {
  return submitComment(payload.content, payload.parentCommentId);
}

function canDeleteThreadComment(comment: DiscussionCommentRecord) {
  return canDeleteComment(comment);
}
</script>
