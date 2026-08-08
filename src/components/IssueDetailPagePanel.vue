<template>
  <ContentDetailPagePanel
    :author-uid="issue.canViewAuthor ? issue.author_uid : null"
    :initial-tab="initialTab"
    back-label="issue.returnToProposalList"
    :content="issue.content"
    :content-loading="contentLoading"
    details-label="issue.proposalContent"
    :notice-content="issueNotice?.content"
    :notice-fallback-alt="t('issue.resultImage', { title: issue.title })"
    :notice-markdown="issue.status !== 'review-rejected'"
    :notice-title="issueNotice?.title"
    :notice-tone="issueNotice?.tone"
    :show-author="showAuthor"
    :title="issue.title"
    @back="emit('back')"
  >
    <template #header>
      <TagBadge class="border-ink-200 bg-ink-100/50 dark:border-ink-800 dark:bg-ink-950/50">
        {{ categoryLabel }}
      </TagBadge>
      <TagBadge elevated class="font-semibold" :class="statusClass">
        {{ statusLabel }}
      </TagBadge>
      <TagBadge
        v-if="issue.support_enabled && issue.support_met_at"
        elevated
        class="bg-success-container font-semibold text-on-success-container"
      >
        <span class="hidden md:inline">{{ t('issue.proposalAuthor') }}</span>
        <span class="md:hidden">{{ t('issue.author') }}</span>
      </TagBadge>
    </template>

    <template #actions="{ compact }">
      <IssueDetailSupportFooter
        :can-manage="issue.canManageIssue"
        :is-admin="isAdmin"
        :compact="compact"
        :current-user-supported="currentUserSupported"
        :issue="issue"
        :operation-time-items="operationTimeItems"
        :status-label="statusLabel"
        :support-closed="supportClosed"
        :support-count="supportCount"
        :support-progress-style="supportProgressStyle"
        :support-remaining-label="supportRemainingLabel"
        @content-unavailable="emit('contentUnavailable', $event)"
        @delete="emit('delete')"
        @share="emit('share')"
        @supported="emit('supported', $event)"
        @moderate="handleModerate"
        @edit-result="handleEditResult"
      />
    </template>

    <template #comments="{ embedded }">
      <div v-if="contentLoading" class="space-y-3 py-2" role="status" :aria-label="t('comments.loadingComments')">
        <SkeletonBlock class="block h-4 w-2/3 rounded" />
        <SkeletonBlock class="block h-16 w-full rounded-2xl" />
        <SkeletonBlock class="block h-16 w-11/12 rounded-2xl" />
      </div>
      <IssueComments
        v-else
        :accessible="commentsReadable"
        :can-compose="commentsEnabled"
        :category="issue.category"
        :embedded="embedded"
        :focus-comment-id="focusCommentId"
        :issue-id="issue.id"
        class="h-full"
        @content-unavailable="emit('contentUnavailable', $event)"
      />
    </template>
  </ContentDetailPagePanel>

  <!-- Moderation Dialogs -->
  <IssueReviewDialog
    :open="isReviewDialogOpen"
    :issue="issue"
    @success="handleStatusChanged"
    @close="isReviewDialogOpen = false"
  />

  <IssueStatusDialog
    :open="isStatusDialogOpen"
    :issue="issue"
    :initial-action="statusDialogInitialAction"
    @success="handleStatusChanged"
    @close="isStatusDialogOpen = false"
  />
</template>

<script setup lang="ts">
import { computed, ref, toRef } from 'vue';
import { useIssueDisplay } from '@/composables/useIssueDisplay';
import { useStatusStyling } from '@/composables/useStatusStyling';
import { getSupportProgressPercent, getSupportRemainingLabel } from '@/lib/issue-status';
import { getIssueNotice } from '@/lib/issue-notice';
import type { IssueRecord } from '@/types';

import TagBadge from '@/components/ui/atoms/TagBadge.vue';
import SkeletonBlock from '@/components/ui/atoms/SkeletonBlock.vue';
import ContentDetailPagePanel from '@/components/ContentDetailPagePanel.vue';
import IssueDetailSupportFooter from '@/components/IssueDetailSupportFooter.vue';
import IssueComments from '@/components/IssueComments.vue';
import { useSession } from '@/composables/useSession';
import { issueAllowsCommentsForStatus, issueCategoryAllowsComments } from '@/constants/categories';
import { useI18n } from '@/i18n';

// Shared Moderation Dialogs
import IssueReviewDialog from '@/components/IssueReviewDialog.vue';
import IssueStatusDialog from '@/components/IssueStatusDialog.vue';

const props = withDefaults(
  defineProps<{
    contentLoading?: boolean;
    issue: IssueRecord;
    currentUserSupported: boolean;
    focusCommentId?: string;
    supportCount: number;
    supportClosed: boolean;
    initialTab?: 'details' | 'comments';
  }>(),
  {
    contentLoading: false,
    focusCommentId: '',
    initialTab: 'details',
  }
);

const emit = defineEmits<{
  contentUnavailable: [issueId: string];
  back: [];
  delete: [];
  'issue-updated': [issue: IssueRecord];
  share: [];
  supported: [payload: { supported: boolean; supportCount: number }];
}>();

const { canManageIssueCategory } = useSession();
const isAdmin = computed(() => canManageIssueCategory(props.issue.category));

const isReviewDialogOpen = ref(false);
const isStatusDialogOpen = ref(false);
const statusDialogInitialAction = ref<'processing' | 'closed'>('processing');
const { t } = useI18n();

const {
  derivedStatus,
  categoryLabel,
  statusLabel,
  primaryTimeLabel,
  primaryTimeValueLabel,
  operationTimeItems,
  remainingDays,
} = useIssueDisplay(toRef(props, 'issue'));

const { statusClass } = useStatusStyling(derivedStatus, 'dialog');
const issueNotice = computed(() => getIssueNotice(props.issue, statusLabel.value));

const supportProgressStyle = computed(() => {
  const progress = getSupportProgressPercent(props.supportCount, props.issue.support_goal);
  return { transform: `scaleX(${progress / 100})` };
});

const showAuthor = computed(() => props.issue.canViewAuthor);

const supportRemainingLabel = computed(() => getSupportRemainingLabel(remainingDays.value));
const commentsAllowedForStatus = computed(() => issueAllowsCommentsForStatus(
  props.issue.read_access,
  props.issue.status,
));
const commentsAllowedForCategory = computed(() => issueCategoryAllowsComments(props.issue.category));
// Do not load or subscribe to comments before the proposal reaches a commentable status.
// Management access affects proposal visibility, not whether the comments panel should issue reads.
const commentsReadable = computed(() =>
  props.issue.status !== 'under-review' && props.issue.status !== 'review-rejected'
);
const commentsEnabled = computed(() =>
  props.issue.comments_enabled && commentsAllowedForCategory.value && commentsAllowedForStatus.value
);

function handleModerate() {
  isReviewDialogOpen.value = true;
}

function handleEditResult() {
  statusDialogInitialAction.value = props.issue.status === 'pending' ? 'processing' : 'closed';
  isStatusDialogOpen.value = true;
}

function handleStatusChanged(updatedIssue: IssueRecord) {
  emit('issue-updated', updatedIssue);
}

</script>
