<template>
  <div class="flex min-h-0 flex-col">
    <div class="shrink-0 pb-1" :class="compact ? 'space-y-2' : 'space-y-4'">
      <h2
        class="break-words font-semibold tracking-[0.015em] text-ink-900 dark:text-ink-50"
        :class="compact ? 'text-xl leading-snug' : 'text-xl leading-snug sm:text-2xl'"
      >
        {{ title }}
      </h2>

      <div
        v-if="showAuthor"
        class="flex items-center border-b border-ink-100 text-sm dark:border-ink-800"
        :class="compact ? 'flex-wrap gap-2 pb-2' : 'gap-3 pb-3'"
      >
        <AuthorAvatar
          :author-uid="authorUid"
          :photo-url="authorPhotoUrl"
          :name="authorName"
          :size="compact ? 'sm' : 'md'"
          :alt-text="`${authorName} 的頭像`"
        />
        <div class="min-w-0">
          <p class="truncate text-sm font-semibold text-ink-900 dark:text-ink-100">{{ authorName }}</p>
          <p v-if="authorSecondary" class="mt-0.5 truncate text-xs text-ink-500 dark:text-ink-400">
            {{ authorSecondary }}
          </p>
        </div>
      </div>
    </div>

    <div class="min-h-0 py-2" :class="scrollContent ? 'my-2 flex-1 overflow-y-auto pr-2' : ''">
      <div
        v-if="noticeContent"
        class="mb-4 rounded-[var(--radius-inner)] border-0 px-4 py-3 text-sm shadow-note"
        :class="noticeTone === 'error'
          ? 'bg-error-container/80 text-on-error-container'
          : 'bg-success-container/80 text-on-success-container'"
      >
        <p class="font-semibold">{{ noticeTitle }}</p>
        <div class="mt-1 leading-6">
          <MarkdownMediaContent
            v-if="noticeMarkdown"
            :content="noticeContent"
            :fallback-alt="noticeFallbackAlt || `${title} 的結果圖片`"
          />
          <p v-else>{{ noticeContent }}</p>
        </div>
      </div>

      <MarkdownMediaContent :content="content" :fallback-alt="title" />
    </div>
  </div>
</template>

<script setup lang="ts">
import AuthorAvatar from '@/components/AuthorAvatar.vue';
import MarkdownMediaContent from '@/components/MarkdownMediaContent.vue';

withDefaults(defineProps<{
  authorName: string;
  authorPhotoUrl?: string | null;
  authorSecondary?: string;
  authorUid?: string | null;
  compact?: boolean;
  content: string;
  noticeContent?: string | null;
  noticeFallbackAlt?: string;
  noticeMarkdown?: boolean;
  noticeTitle?: string;
  noticeTone?: 'error' | 'success';
  scrollContent?: boolean;
  showAuthor?: boolean;
  title: string;
}>(), {
  authorPhotoUrl: null,
  authorSecondary: '',
  authorUid: null,
  compact: false,
  noticeContent: '',
  noticeFallbackAlt: '',
  noticeMarkdown: false,
  noticeTitle: '',
  noticeTone: 'success',
  scrollContent: false,
  showAuthor: true,
});
</script>
