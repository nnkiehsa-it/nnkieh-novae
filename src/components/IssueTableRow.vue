<template>
  <ContentCardShell
    :author-uid="issue.canViewAuthor ? issue.author_uid : null"
    :highlight-query="highlightQuery"
    :show-author="issue.canViewAuthor"
    :status-class="statusClass"
    :status-label="statusLabel"
    :time-label="primaryTimeValueLabel"
    :title="issue.title"
    @intent="emit('detail-intent', issue)"
    @open="openDetails()"
  >
    <template #supplement>
      <ContentNoticePanel
        v-if="issueNoticeSummary"
        compact
        class="mt-4"
        :tone="issueNoticeSummary.tone"
      >
        <span class="font-semibold">{{ t(issueNoticeSummary.title) }}：</span>
        <span>{{ issueNoticeSummary.content }}</span>
      </ContentNoticePanel>
      <div v-else-if="issue.support_enabled" class="mt-3 rounded-xl bg-ink-100/60 px-3 py-2.5 dark:bg-ink-900/40">
        <div class="flex items-center justify-between gap-3 text-xs">
          <span class="font-semibold tabular-nums text-ink-700 dark:text-ink-300">
            {{ t('issue.countGoalSupports', { count: supportCount, goal: issue.support_goal ?? 0 }) }}
          </span>
          <span v-if="supportRemainingLabel" class="text-ink-500 dark:text-ink-400">
            {{ supportRemainingLabel }}
          </span>
        </div>
        <div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink-200/60 dark:bg-ink-800/80" aria-hidden="true">
          <div
            class="progress-fill h-full rounded-full bg-ink-900 dark:bg-ink-100"
            :style="supportProgressStyle"
          ></div>
        </div>
      </div>
      <p v-else class="mt-4 text-xs text-ink-500 dark:text-ink-400">{{ t('issue.thisProposalDoesNotRequireSupport') }}</p>
    </template>

    <template #actions>
      <AppButton
        variant="toolbar"
        class="h-8 w-8 rounded-full p-0"
        :title="t('comments.viewComments')"
        :aria-label="t('comments.viewComments')"
        @click.stop="openDetails('comments')"
      >
        <AppIcon name="comment" />
      </AppButton>
      <VoteButtons
        v-if="issue.support_enabled && !issueNoticeSummary"
        :issue-id="issue.id"
        :current-user-supported="currentUserSupported"
        :support-count="supportCount"
        :support-closed="supportClosed"
        :status-label="statusLabel"
        :compact="true"
        @supported="handleSupport"
      />
    </template>
  </ContentCardShell>
</template>

<script setup lang="ts">
import { computed, toRef } from 'vue';
import VoteButtons from '@/components/VoteButtons.vue';
import AppIcon from '@/components/ui/atoms/AppIcon.vue';
import AppButton from '@/components/ui/atoms/AppButton.vue';
import ContentCardShell from '@/components/ui/organisms/ContentCardShell.vue';
import SurfacePanel from '@/components/ui/molecules/SurfacePanel.vue';
import ContentNoticePanel from '@/components/ui/molecules/ContentNoticePanel.vue';
import { useIssueItemController } from '@/composables/useIssueItemController';
import { getIssueNotice } from '@/lib/issue-notice';
import { stripMarkdownImages } from '@/lib/markdown-images';
import type { IssueRecord } from '@/types';
import { useI18n } from '@/i18n';

const props = withDefaults(defineProps<{
  issue: IssueRecord;
  highlightQuery?: string;
}>(), {
  highlightQuery: '',
});

const emit = defineEmits<{
  'detail-intent': [issue: IssueRecord];
  'support-changed': [payload: { issueId: string; supported: boolean; supportCount: number }];
  'open-details': [payload: { issue: IssueRecord; initialTab: 'details' | 'comments' }];
}>();
const { t } = useI18n();

const {
  statusLabel,
  primaryTimeValueLabel,
  currentUserSupported,
  supportCount,
  statusClass,
  supportClosed,
  supportProgressStyle,
  supportRemainingLabel,
  handleSupport,
  openDetails,
} = useIssueItemController(
  toRef(props, 'issue'),
  'table-row',
  (payload) => emit('support-changed', payload),
  (payload) => emit('open-details', payload),
);
const issueNoticeSummary = computed(() => {
  const notice = getIssueNotice(props.issue, statusLabel.value);
  if (!notice) return null;
  return {
    ...notice,
    content: stripMarkdownImages(notice.content).replace(/\s+/g, ' ').trim() || statusLabel.value,
  };
});
</script>
