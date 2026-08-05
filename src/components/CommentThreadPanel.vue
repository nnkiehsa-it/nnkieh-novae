<template>
  <section
    class="relative flex min-w-0 flex-col"
    :class="embedded ? '' : 'h-full min-h-0'"
  >
    <div
      ref="scrollContainerRef"
      class="scroll-shadow-space--compact overscroll-contain"
      :class="embedded ? 'overflow-visible' : 'min-h-0 flex-1 overflow-auto'"
    >
      <SkeletonCommentList v-if="visibleLoading" />

      <EmptyStatePanel
        v-else-if="error"
        class="!px-3 !py-7"
        title="comments.failedToLoadComments"
        :description="error"
        icon="warning"
        tone="danger"
        action-label="dashboard.refresh"
        @action="onRetry"
      />

      <div v-else-if="comments.length" class="space-y-0.5">
        <CommentItem
          v-for="(comment, index) in comments"
          :key="comment.id"
          class="feed-enter"
          :style="{ '--feed-enter-index': Math.min(index, LOAD_MORE_PLACEHOLDER_COUNT - 1) }"
          :comment="comment"
          :can-delete="canDeleteComment(comment)"
          :can-delete-reply="canDeleteComment"
          :can-reply="canCompose"
          :focus-comment-id="focusCommentId"
          :replies-expanded="expandedReplyCommentIds.has(comment.id)"
          :deleting="deletingId === comment.id"
          :deleting-id="deletingId"
          @delete="requestDeleteComment(comment.id)"
          @delete-reply="requestDeleteComment"
          @reply="openReplyComposer(comment.id)"
          @update-replies-expanded="updateRepliesExpanded"
        />
        <SkeletonCommentList
          v-if="loadingMore"
          :count="LOAD_MORE_PLACEHOLDER_COUNT"
          class="pt-2"
        />
        <FeedLoadMoreControl
          v-show="!loadingMore"
          :has-more="hasMore"
          :loading="loadingMore"
          :error="Boolean(loadMoreError)"
          @load-more="onLoadMore"
        />
        <div v-if="hasMore" ref="loadMoreSentinel" class="h-1" aria-hidden="true"></div>
      </div>
    </div>

    <div class="shrink-0 bg-transparent pt-2">
      <CommentComposer
        :target-id="targetId"
        :parent-comment-id="replyingToCommentId || null"
        :submitting="submitting"
        :error="submitError"
        :disabled="!canCompose"
        :disabled-placeholder="disabledComposerLabelKey"
        :mobile-docked="mobileDocked"
        @close="closeComposer"
        @submit="handleSubmitComment"
      />
    </div>

    <ConfirmDialog
      :open="Boolean(commentPendingDelete)"
      title="comments.areYouSureYouWantToDeleteThisComment"
      message="comments.thisCommentCannotBeRestoredAfterDeletion"
      confirm-label="comments.confirmDeletion"
      :busy="Boolean(commentPendingDelete) && deletingId === commentPendingDelete"
      @cancel="closeDeleteDialog"
      @confirm="confirmDeleteComment"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, toRef, watch } from 'vue';
import CommentComposer from '@/components/CommentComposer.vue';
import CommentItem from '@/components/CommentItem.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import EmptyStatePanel from '@/components/ui/molecules/EmptyStatePanel.vue';
import FeedLoadMoreControl from '@/components/ui/molecules/FeedLoadMoreControl.vue';
import SkeletonCommentList from '@/components/ui/organisms/SkeletonCommentList.vue';
import { useMinimumLoading } from '@/composables/useMinimumLoading';
import { useInfiniteScroll } from '@/composables/useInfiniteScroll';
import type { DiscussionCommentRecord } from '@/types';
import { useI18n, type MessageKey } from '@/i18n';
import { LOAD_MORE_PLACEHOLDER_COUNT } from '@/lib/feed-loading';

const props = withDefaults(defineProps<{
  canDeleteComment: (comment: DiscussionCommentRecord) => boolean;
  canCompose?: boolean;
  embedded?: boolean;
  comments: DiscussionCommentRecord[];
  mobileDocked?: boolean;
  deletingId: string;
  error: string;
  loaded: boolean;
  loading: boolean;
  hasMore?: boolean;
  loadingMore?: boolean;
  loadMoreError?: string;
  submitError: string;
  submitting: boolean;
  targetId: string;
  focusCommentId?: string;
  onDeleteComment: (commentId: string) => Promise<void>;
  onLoadMore?: () => Promise<void>;
  onRetry: () => Promise<void>;
  onSubmitComment: (payload: { content: string; parentCommentId: string | null }) => Promise<boolean>;
  disabledComposerLabelKey?: MessageKey;
}>(), {
  canCompose: true,
  disabledComposerLabelKey: 'comments.commentsAreCurrentlyDisabled',
  embedded: false,
  focusCommentId: '',
  hasMore: false,
  loadingMore: false,
  mobileDocked: false,
  loadMoreError: '',
  onLoadMore: async () => undefined,
});

const replyingToCommentId = ref('');
const { t } = useI18n();
const commentPendingDelete = ref('');
const expandedReplyCommentIds = ref<Set<string>>(new Set());
const scrollContainerRef = ref<HTMLElement | null>(null);
let focusInProgress = false;
const { visibleLoading } = useMinimumLoading(toRef(props, 'loading'));
const infiniteScrollDisabled = computed(() =>
  props.loading || props.loadingMore || Boolean(props.loadMoreError) || !props.hasMore
);
const { sentinel: loadMoreSentinel } = useInfiniteScroll({
  disabled: infiniteScrollDisabled,
  loading: toRef(props, 'loadingMore'),
  onLoadMore: props.onLoadMore,
  root: props.embedded ? undefined : scrollContainerRef,
  rootMargin: '240px 0px',
});

function requestDeleteComment(commentId: string) {
  commentPendingDelete.value = commentId;
}

function closeDeleteDialog() {
  if (props.deletingId) {
    return;
  }

  commentPendingDelete.value = '';
}

async function confirmDeleteComment() {
  if (!commentPendingDelete.value) {
    return;
  }

  await props.onDeleteComment(commentPendingDelete.value);
  commentPendingDelete.value = '';
}

function closeComposer() {
  if (props.submitting) {
    return;
  }

  replyingToCommentId.value = '';
}

function openReplyComposer(commentId: string) {
  if (!props.canCompose) return;
  updateRepliesExpanded({ commentId, expanded: true });
  replyingToCommentId.value = commentId;
}

function updateRepliesExpanded(payload: { commentId: string; expanded: boolean }) {
  const nextIds = new Set(expandedReplyCommentIds.value);
  if (payload.expanded) {
    nextIds.add(payload.commentId);
  } else {
    nextIds.delete(payload.commentId);
  }
  expandedReplyCommentIds.value = nextIds;
}

async function handleSubmitComment(payload: { content: string; parentCommentId: string | null }) {
  if (!props.canCompose) return false;
  const success = await props.onSubmitComment(payload);
  if (success) {
    replyingToCommentId.value = '';
  }
}

function containsComment(comments: DiscussionCommentRecord[], commentId: string) {
  return comments.some((comment) =>
    comment.id === commentId || comment.replies.some((reply) => reply.id === commentId)
  );
}

async function focusTargetComment() {
  const commentId = props.focusCommentId?.trim() ?? '';
  if (!commentId || props.loading || focusInProgress) return;

  if (!containsComment(props.comments, commentId)) {
    if (props.hasMore && !props.loadingMore) {
      focusInProgress = true;
      try {
        await props.onLoadMore();
      } finally {
        focusInProgress = false;
      }
    }
    return;
  }

  await nextTick();
  const target = Array.from(scrollContainerRef.value?.querySelectorAll<HTMLElement>('[data-comment-id]') ?? [])
    .find((element) => element.dataset.commentId === commentId);
  target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

watch(
  () => [props.focusCommentId, props.loaded, props.loading, props.loadingMore, props.comments.length] as const,
  () => {
    void focusTargetComment();
  },
  { immediate: true },
);
</script>
