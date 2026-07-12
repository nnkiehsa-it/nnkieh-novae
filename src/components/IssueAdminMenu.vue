<template>
  <div
    v-if="isAdmin"
    :class="compact ? 'relative inline-block text-left z-30' : 'space-y-3 relative z-30'"
  >
    <p v-if="!compact" class="field-label">管理員狀態調整</p>
    <div :class="compact ? '' : 'relative inline-block w-full sm:w-60 text-left'">
      <!-- Toggle Button (Normal) -->
      <button
        v-if="!compact"
        ref="triggerRef"
        type="button"
        class="interactive-surface flex w-full items-center justify-between gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold"
        :class="[
          isDropdownOpen
            ? 'border-ink-400 bg-white ring-2 ring-secondary/15 dark:border-ink-600 dark:bg-ink-900'
            : 'border-ink-200/80 bg-ink-50/50 hover:bg-ink-100/50 dark:border-ink-700/80 dark:bg-ink-900/30 dark:hover:bg-ink-800/30',
          getDropdownButtonTextClass(adminStatus)
        ]"
        :disabled="isClosed"
        @click="isDropdownOpen = !isDropdownOpen"
      >
        <span class="flex items-center gap-2">
          <span class="h-2 w-2 rounded-full" :class="getStatusDotClass(adminStatus)"></span>
          {{ getStatusLabel(adminStatus) }}
        </span>
        <AppIcon
          name="chevron-down"
          class="h-4 w-4 text-ink-500 transition-transform duration-300"
          :class="{ 'rotate-180': isDropdownOpen }"
        />
      </button>

      <!-- Toggle Button (Compact three dots) -->
      <button
        v-else
        ref="triggerRef"
        type="button"
        class="button-toolbar h-8 w-8 rounded-full p-0"
        :class="{ 'text-ink-800 dark:text-ink-100': isDropdownOpen }"
        title="管理提案"
        aria-label="管理提案"
        @click="isDropdownOpen = !isDropdownOpen"
      >
        <AppIcon name="more-horizontal" :size="4.5" :stroke-width="1.8" />
      </button>

      <!-- Dropdown Menu -->
      <transition name="popover">
        <div
          v-if="isDropdownOpen"
          ref="dropdownRef"
          class="popover-panel popover-panel--compact fixed z-[100] origin-top-right"
          :class="compact ? 'w-44' : 'w-60'"
          :style="dropdownStyle"
          @click.stop
          @pointerdown.stop
        >
          <!-- Under-review state: Show "審核提案" -->
          <button
            v-if="isUnderReview"
            type="button"
            class="menu-item justify-between"
            @click.stop="openReviewDialog"
          >
            <span class="font-semibold text-ink-900 dark:text-ink-100">
              審核提案
            </span>
          </button>

          <!-- Approved state (pending / processing): Update status/result in one dialog -->
          <template v-if="isProcessingOrPending">
            <button
              type="button"
              class="menu-item justify-between"
              @click.stop="openStatusDialog"
            >
              <span class="font-semibold text-ink-900 dark:text-ink-100">
                變更提案狀態/結果
              </span>
            </button>
          </template>

          <!-- Danger zone: Delete (compact only) -->
          <div v-if="compact" class="mt-1 border-t border-error/20 pt-1">
            <button
              type="button"
              class="menu-item menu-item-danger"
              @click.stop="onDeleteClick"
            >
              <AppIcon name="trash" :size="3" />
              <span>刪除提案</span>
            </button>
          </div>
        </div>
      </transition>
    </div>
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
import { computed, ref, watch } from 'vue';
import { useSession } from '@/composables/useSession';
import { ISSUE_STATUS_LABELS } from '@/constants/statuses';
import { useStatusStyling } from '@/composables/useStatusStyling';
import { useClickOutside } from '@/composables/useClickOutside';
import { useDropdownPosition } from '@/composables/useDropdownPosition';
import AppIcon from '@/components/ui/AppIcon.vue';
import type { IssueRecord, IssueStatus } from '@/types';

// Shared Dialog Components
import IssueReviewDialog from '@/components/IssueReviewDialog.vue';
import IssueStatusDialog from '@/components/IssueStatusDialog.vue';

const props = defineProps<{
  issue: IssueRecord;
  compact?: boolean;
}>();

const emit = defineEmits<{
  'status-changed': [issue: IssueRecord];
  'message': [message: string];
  'error': [error: string];
  'dropdown-open': [isOpen: boolean];
  'delete': [];
}>();

const triggerRef = ref<HTMLButtonElement | null>(null);
const dropdownRef = ref<HTMLDivElement | null>(null);

const isReviewDialogOpen = ref(false);
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

const { isAdmin } = useSession();
const adminStatus = computed(() => props.issue.status);
const isDropdownOpen = ref(false);

useClickOutside(isDropdownOpen, [triggerRef, dropdownRef], () => {
  isDropdownOpen.value = false;
});

watch(isDropdownOpen, (open) => {
  emit('dropdown-open', open);
});

const { dropdownStyle } = useDropdownPosition(
  triggerRef,
  isDropdownOpen,
  {
    fallbackHeight: props.compact ? 280 : 240,
    width: props.compact ? 176 : 240,
  },
  dropdownRef,
);

function onDeleteClick() {
  isDropdownOpen.value = false;
  emit('delete');
}

function openReviewDialog() {
  isDropdownOpen.value = false;
  isReviewDialogOpen.value = true;
}

function openStatusDialog() {
  isDropdownOpen.value = false;
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
  return ISSUE_STATUS_LABELS[status] || status;
}
</script>
