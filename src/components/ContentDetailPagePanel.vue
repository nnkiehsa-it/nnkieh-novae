<template>
  <DetailPageShell
    :back-label="backLabel"
    :comment-count="commentCount"
    :comments-label="commentsLabel"
    :details-label="detailsLabel"
    :initial-tab="initialTab"
    :show-comments="showComments"
    :show-mobile-comments="showMobileComments"
    :show-mobile-back-button="showMobileBackButton"
    @back="emit('back')"
  >
    <template #header>
      <slot name="header" />
    </template>

    <template #details="{ compact, scrollContent }">
      <ContentDetailBody
        :author-secondary="authorSecondary"
        :author-uid="authorUid"
        :compact="compact"
        :content="content"
        :content-loading="contentLoading"
        :context-content="contextContent"
        :context-title="contextTitle"
        :context-tone="contextTone"
        :notice-content="noticeContent"
        :notice-fallback-alt="noticeFallbackAlt"
        :notice-markdown="noticeMarkdown"
        :notice-title="noticeTitle"
        :notice-tone="noticeTone"
        :scroll-content="scrollContent"
        :show-author="showAuthor"
        :title="title"
      />
    </template>

    <template #actions="{ compact }">
      <slot name="actions" :compact="compact" />
    </template>

    <template #comments="{ compactHeader, embedded }">
      <slot name="comments" :compact-header="compactHeader" :embedded="embedded" />
    </template>
  </DetailPageShell>
</template>

<script setup lang="ts">
import ContentDetailBody from '@/components/ContentDetailBody.vue';
import DetailPageShell from '@/components/ui/organisms/DetailPageShell.vue';

withDefaults(defineProps<{
  authorSecondary?: string;
  authorUid?: string | null;
  backLabel: string;
  commentCount?: number;
  commentsLabel?: string;
  content: string;
  contentLoading?: boolean;
  contextContent?: string;
  contextTitle?: string;
  contextTone?: 'error' | 'neutral' | 'success';
  detailsLabel: string;
  initialTab?: 'details' | 'comments';
  noticeContent?: string | null;
  noticeFallbackAlt?: string;
  noticeMarkdown?: boolean;
  noticeTitle?: string;
  noticeTone?: 'error' | 'success';
  showAuthor?: boolean;
  showComments?: boolean;
  showMobileComments?: boolean;
  showMobileBackButton?: boolean;
  title: string;
}>(), {
  authorSecondary: '',
  authorUid: null,
  commentCount: 0,
  commentsLabel: 'comments.title',
  contentLoading: false,
  contextContent: '',
  contextTitle: '',
  contextTone: 'neutral',
  initialTab: 'details',
  noticeContent: '',
  noticeFallbackAlt: '',
  noticeMarkdown: false,
  noticeTitle: '',
  noticeTone: 'success',
  showAuthor: true,
  showComments: true,
  showMobileComments: true,
  showMobileBackButton: false,
  supportCount: 0,
  supportEnabled: false,
  supportGoal: 0,
  supportProgressStyle: () => ({}),
  supportRemainingLabel: '',
});

const emit = defineEmits<{
  back: [];
}>();

defineSlots<{
  actions(props: { compact: boolean }): unknown;
  comments(props: { compactHeader: boolean; embedded: boolean }): unknown;
  header(): unknown;
}>();
</script>
