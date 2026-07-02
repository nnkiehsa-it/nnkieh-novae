<template>
  <DetailDialogShell
    :initial-tab="initialTab"
    :open="open"
    details-label="提案內容"
    @close="emit('close')"
  >
    <template #header>
      <span class="tag border-ink-200 bg-ink-100/50 dark:border-ink-800 dark:bg-ink-950/50">
        {{ categoryLabel }}
      </span>
      <span class="tag font-semibold shadow-sm" :class="statusClass">
        {{ statusLabel }}
      </span>
      <span
        v-if="issue.support_enabled && issue.support_met_at"
        class="tag border-primary/30 bg-primary-container/50 font-semibold text-on-primary-container shadow-sm"
      >
        <span class="hidden md:inline">已達附議門檻</span>
        <span class="md:hidden">已達門檻</span>
      </span>
    </template>

    <template #details="{ compact, scrollContent }">
      <IssueDetailContent
        :compact="compact"
        :created-label="createdLabel"
        :display-author-name="displayAuthorName"
        :display-photo-url="displayPhotoUrl"
        :issue="issue"
        :scroll-content="scrollContent"
        :show-author="showAuthor"
      />
    </template>

    <template #actions>
      <IssueDetailSupportFooter
        :can-manage="isAdmin || isOwnIssue"
        :compact="false"
        :created-label="createdLabel"
        :current-user-supported="currentUserSupported"
        :issue="issue"
        :response-deadline-label="responseDeadlineLabel"
        :status-label="statusLabel"
        :support-closed="supportClosed"
        :support-count="supportCount"
        :support-deadline-label="supportDeadlineLabel"
        :support-met-label="supportMetLabel"
        :support-progress-style="supportProgressStyle"
        :support-remaining-label="supportRemainingLabel"
        @content-unavailable="emit('contentUnavailable', $event)"
        @delete="emit('delete')"
        @share="emit('share')"
        @supported="emit('supported', $event)"
      />
    </template>

    <template #comments="{ compactHeader }">
      <IssueComments
        :can-compose="commentsEnabled"
        :compact-header="compactHeader"
        :issue-id="issue.id"
        class="h-full"
        @content-unavailable="emit('contentUnavailable', $event)"
      />
    </template>
  </DetailDialogShell>
</template>

<script setup lang="ts">
import { computed, toRef } from 'vue';
import { useIssueDisplay } from '@/composables/useIssueDisplay';
import { useStatusStyling } from '@/composables/useStatusStyling';
import { getSupportProgressPercent, getSupportRemainingLabel } from '@/lib/issue-status';
import type { IssueRecord } from '@/types';

import DetailDialogShell from '@/components/ui/DetailDialogShell.vue';
import IssueDetailContent from '@/components/IssueDetailContent.vue';
import IssueDetailSupportFooter from '@/components/IssueDetailSupportFooter.vue';
import IssueComments from '@/components/IssueComments.vue';
import { useSession } from '@/composables/useSession';
import { issueAllowsCommentsForStatus, issueStoresAuthorPrivately } from '@/constants/categories';

const props = withDefaults(
  defineProps<{
    open: boolean;
    issue: IssueRecord;
    currentUserSupported: boolean;
    supportCount: number;
    supportClosed: boolean;
    initialTab?: 'details' | 'comments';
  }>(),
  {
    initialTab: 'details',
  }
);

const emit = defineEmits<{
  contentUnavailable: [issueId: string];
  close: [];
  delete: [];
  share: [];
  supported: [payload: { supported: boolean; supportCount: number }];
}>();

const { isAdmin } = useSession();

const {
  displayAuthorName,
  displayPhotoUrl,
  derivedStatus,
  categoryLabel,
  statusLabel,
  createdLabel,
  supportDeadlineLabel,
  responseDeadlineLabel,
  supportMetLabel,
  remainingDays,
  isOwnIssue,
} = useIssueDisplay(toRef(props, 'issue'));

const { statusClass } = useStatusStyling(derivedStatus, 'dialog');

const supportProgressStyle = computed(() => {
  const progress = getSupportProgressPercent(props.supportCount, props.issue.support_goal);
  return { width: `${progress}%` };
});

const showAuthor = computed(() => !issueStoresAuthorPrivately(props.issue.category) || isAdmin.value || isOwnIssue.value);

const supportRemainingLabel = computed(() => getSupportRemainingLabel(remainingDays.value));
const commentsEnabled = computed(() => issueAllowsCommentsForStatus(props.issue.category, props.issue.status));
</script>
