<template>
  <div class="flex min-h-0 flex-col">
    <div class="shrink-0 pb-3">
      <div class="flex items-start gap-3.5">
        <AuthorAvatar
          v-if="showAuthor && authorUid"
          :author-uid="authorUid"
          :size="compact ? 'md' : 'lg'"
          :alt-text="t('notification.nameAvatar', { name: authorName })"
          class="shrink-0 rounded-full"
        />
        <div class="min-w-0 flex-1">
          <div v-if="showAuthor && authorUid" class="flex items-center gap-2">
            <SkeletonBlock v-if="authorProfile.loading" class="block h-4 w-24 rounded" />
            <template v-else>
              <span class="truncate text-xs font-normal text-ink-600 dark:text-ink-300 sm:text-sm">
                {{ authorName }}
              </span>
              <span v-if="authorSecondary" class="shrink-0 text-xs font-normal text-ink-400 dark:text-ink-500">
                · {{ authorSecondary }}
              </span>
            </template>
          </div>

          <h2
            class="mt-1.5 break-words font-semibold tracking-[0.01em] text-ink-950 dark:text-ink-50"
            :class="compact ? 'text-xl leading-snug' : 'text-2xl leading-snug sm:text-2xl'"
          >
            {{ title }}
          </h2>
        </div>
      </div>
    </div>

    <div class="min-h-0 py-2" :class="scrollContent ? 'my-2 flex-1 overflow-y-auto pr-2' : ''">
      <ContentNoticePanel
        v-if="contextContent"
        class="mb-4"
        :title="contextTitle"
        :tone="contextTone"
      >
        <p>{{ contextContent }}</p>
      </ContentNoticePanel>

      <ContentNoticePanel
        v-if="noticeContent"
        class="mb-4"
        :title="noticeTitle"
        :tone="noticeTone"
      >
        <MarkdownMediaContent
          v-if="noticeMarkdown"
          :content="noticeContent"
          :fallback-alt="noticeFallbackAlt || t('image.resultImageForTitle', { title })"
        />
        <p v-else>{{ noticeContent }}</p>
      </ContentNoticePanel>

      <div v-if="contentLoading" class="space-y-3 py-1" role="status" :aria-label="t('common.loading')">
        <SkeletonBlock class="block h-4 w-full rounded" />
        <SkeletonBlock class="block h-4 w-11/12 rounded" />
        <SkeletonBlock class="block h-4 w-4/5 rounded" />
        <SkeletonBlock class="mt-5 block h-32 w-full rounded-2xl" />
      </div>
      <MarkdownMediaContent v-else :content="content" :fallback-alt="title" />
    </div>
  </div>
</template>

<script setup lang="ts">
import AuthorAvatar from '@/components/AuthorAvatar.vue';
import MarkdownMediaContent from '@/components/MarkdownMediaContent.vue';
import SkeletonBlock from '@/components/ui/atoms/SkeletonBlock.vue';
import ContentNoticePanel from '@/components/ui/molecules/ContentNoticePanel.vue';
import { useI18n } from '@/i18n';
import { computed } from 'vue';
import { useAuthorProfile } from '@/composables/useAuthorProfile';

const { t } = useI18n();

const props = withDefaults(defineProps<{
  authorSecondary?: string;
  authorUid?: string | null;
  compact?: boolean;
  content: string;
  contentLoading?: boolean;
  contextContent?: string;
  contextTitle?: string;
  contextTone?: 'error' | 'neutral' | 'success';
  noticeContent?: string | null;
  noticeFallbackAlt?: string;
  noticeMarkdown?: boolean;
  noticeTitle?: string;
  noticeTone?: 'error' | 'success';
  scrollContent?: boolean;
  showAuthor?: boolean;
  title: string;
}>(), {
  authorSecondary: '',
  authorUid: null,
  compact: false,
  contentLoading: false,
  contextContent: '',
  contextTitle: '',
  contextTone: 'neutral',
  noticeContent: '',
  noticeFallbackAlt: '',
  noticeMarkdown: false,
  noticeTitle: '',
  noticeTone: 'success',
  scrollContent: false,
  showAuthor: true,
});

const authorProfile = useAuthorProfile(() => props.authorUid);
const authorName = computed(() => (
  authorProfile.value.loading
    ? ''
    : authorProfile.value.profile?.displayName || t('navigation.user')
));
</script>
