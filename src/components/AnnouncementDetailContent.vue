<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="shrink-0 pb-1" :class="compact ? 'space-y-2' : 'space-y-4'">
      <h2
        class="break-words font-bold tracking-tight text-ink-900 dark:text-ink-50"
        :class="compact ? 'text-xl leading-snug' : 'text-xl leading-snug sm:text-2xl'"
      >
        {{ announcement.title }}
      </h2>
      <div
        class="flex items-center border-b border-ink-100 text-sm dark:border-ink-800"
        :class="compact ? 'flex-wrap gap-2 pb-2' : 'gap-3 pb-3'"
      >
        <AuthorAvatar
          :author-uid="announcement.author_uid"
          :photo-url="announcement.author_photo_url"
          :name="announcement.author_name"
          :size="compact ? 'sm' : 'md'"
          :alt-text="`${announcement.author_name} 的頭像`"
        />

        <template v-if="compact">
          <p class="text-sm font-semibold text-ink-900 dark:text-ink-100">
            {{ announcement.author_name }}
          </p>
          <span class="text-ink-300 dark:text-ink-700">&middot;</span>
          <p class="text-xs font-normal text-ink-500/80 dark:text-ink-400/80">{{ publishedLabel }}</p>
        </template>

        <div v-else class="min-w-0">
          <p class="text-sm font-semibold text-ink-900 dark:text-ink-100">
            {{ announcement.author_name }}
          </p>
          <p class="text-xs font-normal text-ink-500/80 dark:text-ink-400/80">發布於 {{ publishedLabel }}</p>
        </div>
      </div>
    </div>

    <div
      class="min-h-0 py-2"
      :class="scrollContent ? 'my-2 flex-1 overflow-y-auto pr-2' : ''"
    >
      <MarkdownMediaContent :content="announcement.content" :fallback-alt="announcement.title" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import MarkdownMediaContent from '@/components/MarkdownMediaContent.vue';
import AuthorAvatar from '@/components/AuthorAvatar.vue';
import { formatDate } from '@/lib/format';
import type { AnnouncementRecord } from '@/types';

const props = defineProps<{
  announcement: AnnouncementRecord;
  compact?: boolean;
  scrollContent?: boolean;
}>();

const publishedLabel = computed(() => formatDate(props.announcement.published_at));
</script>
