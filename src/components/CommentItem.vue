<template>
  <article
    class="group relative border-b px-0 py-4 transition-colors"
    :class="[
      comment.is_admin_comment
        ? 'border-primary/60'
        : 'border-ink-200 dark:border-ink-800'
    ]"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="flex min-w-0 flex-1 items-center gap-3">
        <AuthorAvatar
          :author-uid="comment.author_uid"
          :photo-url="comment.author_photo_url"
          :name="comment.author_name"
          size="md"
          :alt-text="`${comment.author_name} 的頭像`"
        />
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <p class="truncate text-sm font-bold text-ink-800 dark:text-ink-200">{{ comment.author_name }}</p>
            <span
              v-if="comment.is_admin_comment"
              class="shrink-0 rounded-md bg-primary px-1.5 py-0.5 text-xs font-semibold tracking-wide text-on-primary shadow-sm"
            >
              官方回覆
            </span>
          </div>
          <p class="mt-0.5 text-xs font-normal text-ink-500/80 dark:text-ink-400/80">
            {{ formatDate(comment.created_at) }}
          </p>
        </div>
      </div>
      <CompactActionMenu
        v-if="canDelete"
        class="shrink-0 self-start"
        :delete-disabled="deleting"
        :delete-label="deleting ? '刪除中...' : '刪除留言'"
        :show-edit="false"
        title="管理留言"
        @delete="emit('delete')"
      />
    </div>

    <div class="mt-2.5 max-w-none">
      <MarkdownMediaContent :content="comment.content" :fallback-alt="`${comment.author_name} 的留言圖片`" />
    </div>
  </article>
</template>

<script setup lang="ts">
import AuthorAvatar from '@/components/AuthorAvatar.vue';
import CompactActionMenu from '@/components/CompactActionMenu.vue';
import MarkdownMediaContent from '@/components/MarkdownMediaContent.vue';
import { formatDate } from '@/lib/format';
import type { DiscussionCommentRecord } from '@/types';

const props = defineProps<{
  canDelete: boolean;
  comment: DiscussionCommentRecord;
  deleting: boolean;
}>();

const emit = defineEmits<{
  delete: [];
}>();
</script>
