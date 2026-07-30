<template>
  <div
    v-if="isAdmin"
    :class="compact ? 'relative inline-block text-left' : 'space-y-3 relative'"
  >
    <p v-if="!compact" class="field-label">{{ t('issue.admin.title') }}</p>
    <AdaptiveActionMenu ref="menuRef" :title="t('issue.manageProposals')" :width="compact ? 176 : 240" :size="compact ? 'compact' : 'default'">
      <template #trigger="{ open, toggle }">
        <AppButton
          v-if="compact"
          variant="toolbar"
          size="sm"
          class="w-8 rounded-full p-0"
          :class="{ 'text-ink-800 dark:text-ink-100': open }"
          :title="t('issue.manageProposals')"
          :aria-label="t('issue.manageProposals')"
          @click.stop="toggle"
        >
          <AppIcon name="more-horizontal" :size="4.5" :stroke-width="1.8" />
        </AppButton>
        <AppButton
          v-else
          variant="toolbar"
          class="w-full justify-between gap-2 px-4"
          :class="getDropdownButtonTextClass(adminStatus)"
          :disabled="isClosed"
          :active="open"
          @click="toggle"
        >
          <span class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full" :class="getStatusDotClass(adminStatus)"></span>
            {{ getStatusLabel(adminStatus) }}
          </span>
          <AppIcon name="chevron-down" :size="4" class="text-ink-500 transition-transform duration-300" :class="{ 'rotate-180': open }" />
        </AppButton>
      </template>

      <template #default="{ close }">
        <button v-if="isUnderReview" type="button" class="dropdown-item justify-between" @click.stop="openReviewDialog(close)">
          <span class="font-semibold text-ink-900 dark:text-ink-100">{{ t('issue.admin.review') }}</span>
        </button>
        <button v-if="isProcessingOrPending" type="button" class="dropdown-item justify-between" @click.stop="openStatusDialog(close)">
          <span class="font-semibold text-ink-900 dark:text-ink-100">{{ t('issue.admin.changeStatus') }}</span>
        </button>
        <div v-if="compact" class="mt-1 border-t border-error/20 pt-1">
          <button type="button" class="dropdown-item dropdown-item--danger" @click.stop="onDeleteClick(close)">
            <AppIcon name="trash" :size="3" />
            <span>{{ t('issue.admin.delete') }}</span>
          </button>
        </div>
      </template>
    </AdaptiveActionMenu>
  </div>

  <!-- Shared Moderation Dialogs -->
  <IssueReviewDialog
    v-if="isReviewDialogOpen"
    :open="isReviewDialogOpen"
    :issue="issue"
    @success="handleStatusChanged"
    @close="isReviewDialogOpen = false"
  />

  <IssueStatusDialog
    v-if="isStatusDialogOpen"
    :open="isStatusDialogOpen"
    :issue="issue"
    :initial-action="statusDialogInitialAction"
    @success="handleStatusChanged"
    @close="isStatusDialogOpen = false"
  />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useSession } from '@/composables/useSession';
import { ISSUE_STATUS_LABELS } from '@/constants/statuses';
import { useStatusStyling } from '@/composables/useStatusStyling';
import AppIcon from '@/components/ui/atoms/AppIcon.vue';
import AppButton from '@/components/ui/atoms/AppButton.vue';
import AdaptiveActionMenu from '@/components/ui/organisms/AdaptiveActionMenu.vue';
import type { IssueRecord, IssueStatus } from '@/types';
import { useI18n } from '@/i18n';

// Shared Dialog Components
import IssueReviewDialog from '@/components/IssueReviewDialog.vue';
import IssueStatusDialog from '@/components/IssueStatusDialog.vue';

const props = defineProps<{
  issue: IssueRecord;
  compact?: boolean;
}>();
const { t } = useI18n();

const emit = defineEmits<{
  'status-changed': [issue: IssueRecord];
  'message': [message: string];
  'error': [error: string];
  'delete': [];
}>();

const isReviewDialogOpen = ref(false);
const menuRef = ref<InstanceType<typeof AdaptiveActionMenu> | null>(null);
const isStatusDialogOpen = ref(false);
const statusDialogInitialAction = ref<'processing' | 'closed'>('processing');

// Status groupings
const isUnderReview = computed(() => props.issue.status === 'under-review');
const isClosed = computed(() =>
  props.issue.status === 'completed' ||
  props.issue.status === 'infeasible' ||
  props.issue.status === 'review-rejected' ||
  props.issue.status === 'auto-rejected'
);
const isProcessingOrPending = computed(() =>
  props.issue.status === 'pending' ||
  props.issue.status === 'processing'
);

const { canManageIssueCategory } = useSession();
const isAdmin = computed(() => canManageIssueCategory(props.issue.category));
const adminStatus = computed(() => props.issue.status);
function onDeleteClick(close: () => void) {
  close();
  emit('delete');
}

function openReviewDialog(close: () => void) {
  close();
  isReviewDialogOpen.value = true;
}

function openStatusDialog(close: () => void) {
  close();
  statusDialogInitialAction.value = 'processing';
  isStatusDialogOpen.value = true;
}

function handleStatusChanged(updatedIssue: IssueRecord) {
  emit('status-changed', updatedIssue);
}

function getDropdownButtonTextClass(status: IssueStatus) {
  return useStatusStyling(computed(() => status), 'button-text').statusClass.value;
}

function getStatusDotClass(status: IssueStatus) {
  return useStatusStyling(computed(() => status), 'dot').statusClass.value;
}

function getStatusLabel(status: IssueStatus) {
  return t(ISSUE_STATUS_LABELS[status] || status);
}
defineExpose({ open: () => menuRef.value?.open() });
</script>
