<template>
  <CommentThreadPanel
    :can-delete-comment="canDeleteThreadComment"
    :can-compose="canCompose"
    :comments="comments"
    :compact-header="compactHeader"
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
    :on-delete-comment="deleteCommentById"
    :on-submit-comment="handleSubmitComment"
    :submit-error="submitError"
    :submitting="isSubmitting"
    :target-id="issueId"
  />
</template>

<script setup lang="ts">
import { toRef, watch } from 'vue';
import CommentThreadPanel from '@/components/CommentThreadPanel.vue';
import { useIssueComments } from '@/composables/useIssueComments';
import type { DiscussionCommentRecord, IssueCategory } from '@/types';

const props = withDefaults(
  defineProps<{
    canCompose?: boolean;
    focusCommentId?: string;
    issueId: string;
    category: IssueCategory;
    compactHeader?: boolean;
  }>(),
  {
    canCompose: true,
    compactHeader: false,
    focusCommentId: '',
  },
);

const emit = defineEmits<{
  commentCountChanged: [commentCount: number];
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
} = useIssueComments(toRef(props, 'issueId'), toRef(props, 'category'), (issueId) => emit('contentUnavailable', issueId));

watch(
  () => comments.value.length,
  (commentCount) => emit('commentCountChanged', commentCount),
  { immediate: true },
);

async function handleSubmitComment(payload: { content: string; parentCommentId: string | null }) {
  return submitComment(payload.content, payload.parentCommentId);
}

function canDeleteThreadComment(comment: DiscussionCommentRecord) {
  return canDeleteComment(comment);
}
</script>
