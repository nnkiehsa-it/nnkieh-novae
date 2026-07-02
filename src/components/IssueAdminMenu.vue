<template>
  <div
    v-if="isAdmin"
    :class="compact ? 'relative inline-block text-left z-30' : 'space-y-3 relative z-30'"
    @click.stop
    @pointerdown.stop
  >
    <label v-if="!compact" class="field-label">管理員狀態調整</label>
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
        @click.stop="isDropdownOpen = !isDropdownOpen"
      >
        <span class="flex items-center gap-2">
          <span class="h-2 w-2 rounded-full" :class="getStatusDotClass(adminStatus)"></span>
          {{ getStatusLabel(adminStatus) }}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4 text-ink-500 transition-transform duration-300"
          :class="{ 'rotate-180': isDropdownOpen }"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path stroke="none" d="M0 0h24v24H0z" fill="none" />
          <path d="M6 9l6 6l6 -6" />
        </svg>
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
        @click.stop="isDropdownOpen = !isDropdownOpen"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5 text-current" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="5" cy="12" r="1" />
          <circle cx="12" cy="12" r="1" />
          <circle cx="19" cy="12" r="1" />
        </svg>
      </button>

      <!-- Dropdown Menu -->
      <transition name="popover">
        <div
          v-if="isDropdownOpen"
          ref="dropdownRef"
          class="fixed z-[100] origin-top-right rounded-2xl border border-ink-200/80 bg-white p-1.5 shadow-lg dark:border-ink-700/80 dark:bg-ink-900"
          :class="compact ? 'w-44' : 'w-60'"
          :style="dropdownStyle"
          @click.stop
          @pointerdown.stop
        >
          <button
            v-for="option in visibleStatusOptions"
            :key="option.value"
            type="button"
            class="menu-item justify-between"
            :class="[
              adminStatus === option.value
                ? 'text-ink-950 dark:text-ink-50 font-semibold bg-ink-50/50 dark:bg-ink-800/40'
                : 'text-ink-600 dark:text-ink-300'
            ]"
            @click.stop="selectStatus(option.value)"
          >
            <span class="flex items-center gap-2">
              <span class="h-2 w-2 rounded-full" :class="getStatusDotClass(option.value)"></span>
              {{ option.label }}
            </span>
            <svg
              v-if="adminStatus === option.value"
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4 text-ink-900 dark:text-ink-100"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path stroke="none" d="M0 0h24v24H0z" fill="none" />
              <path d="M5 12l5 5l10 -10" />
            </svg>
          </button>

          <!-- Danger zone: Delete (compact only) -->
          <div v-if="compact" class="mt-1 border-t border-error/20 pt-1">
            <button
              type="button"
              class="menu-item menu-item-danger"
              @click.stop="onDeleteClick"
            >
              <TrashIcon :size="3.5" />
              <span>刪除提案</span>
            </button>
          </div>
        </div>
      </transition>
    </div>
    <p
      v-if="!compact && derivedStatus === 'auto-rejected'"
      class="text-xs text-ink-500 dark:text-ink-400"
    >
      這筆提案目前是系統自動判定為未通過，管理員可改成其他狀態，但不能手動指定未通過。
    </p>
  </div>

  <DialogOverlay :open="isRejectionDialogOpen" padded z-index-class="z-[110]" @close="closeRejectionDialog">
    <section
      class="panel panel-pad w-full max-w-lg"
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-rejection-title"
      tabindex="-1"
    >
      <p class="dialog-eyebrow">公共議題審核</p>
      <h3 id="review-rejection-title" class="dialog-title">輸入審核未通過原因</h3>
      <p class="dialog-description">
        原因會透過通知傳給提案者，這筆提案不會公開給其他校內使用者。
      </p>
      <div class="mt-5 space-y-2">
        <label class="field-label" for="review-rejection-reason">不通過原因</label>
        <div class="overflow-hidden rounded-xl border border-ink-200 bg-white shadow-sm transition-colors focus-within:border-secondary focus-within:ring-2 focus-within:ring-secondary/20 dark:border-ink-800 dark:bg-ink-900">
          <textarea
            id="review-rejection-reason"
            v-model="rejectionReason"
            class="block min-h-36 w-full resize-none bg-transparent px-4 py-3 text-base leading-6 text-ink-800 outline-none placeholder:text-ink-400 disabled:cursor-not-allowed disabled:text-ink-500 dark:text-ink-100 dark:placeholder:text-ink-500 md:text-sm"
            maxlength="500"
            placeholder="請簡要說明未通過原因"
            data-autofocus
            :disabled="isRejecting"
          ></textarea>
          <div class="flex items-center justify-end border-t border-ink-100 bg-ink-50/50 px-4 py-2 text-xs font-medium text-ink-500 dark:border-ink-800 dark:bg-ink-950/30 dark:text-ink-400">
            <span :class="{ 'text-error': rejectionReason.length > 450 }">{{ rejectionReason.length }} / 500</span>
          </div>
        </div>
      </div>
      <p v-if="rejectionError" class="mt-2 text-xs font-semibold text-error">{{ rejectionError }}</p>
      <div class="dialog-actions">
        <button type="button" class="button-secondary" :disabled="isRejecting" @click="closeRejectionDialog">
          取消
        </button>
        <button type="button" class="button-secondary border-warning/30 text-warning hover:text-warning" :disabled="isRejecting" @click="submitRejection">
          {{ isRejecting ? '送出中...' : '確認不通過' }}
        </button>
      </div>
    </section>
  </DialogOverlay>
</template>

<script setup lang="ts">
import { computed, ref, toRef } from 'vue';
import { ADMIN_ISSUE_STATUS_OPTIONS, ISSUE_STATUS_LABELS } from '@/constants/statuses';
import { issueRequiresReview } from '@/constants/categories';
import { useIssueDisplay } from '@/composables/useIssueDisplay';
import { useStatusStyling } from '@/composables/useStatusStyling';
import { useIssueAdminStatus } from '@/composables/useIssueAdminStatus';
import { useDropdownPosition } from '@/composables/useDropdownPosition';
import DialogOverlay from '@/components/ui/DialogOverlay.vue';
import TrashIcon from '@/components/ui/TrashIcon.vue';
import type { IssueRecord, IssueStatus } from '@/types';

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

const { derivedStatus } = useIssueDisplay(toRef(props, 'issue'));
const triggerRef = ref<HTMLButtonElement | null>(null);
const dropdownRef = ref<HTMLDivElement | null>(null);
const isRejectionDialogOpen = ref(false);
const isRejecting = ref(false);
const rejectionReason = ref('');
const rejectionError = ref('');
const requiresReview = computed(() => issueRequiresReview(props.issue.category));
const visibleStatusOptions = computed(() => ADMIN_ISSUE_STATUS_OPTIONS.filter((option) =>
  requiresReview.value || (option.value !== 'under-review' && option.value !== 'review-rejected')
));

const {
  isAdmin,
  adminStatus,
  isDropdownOpen,
  updateStatus,
} = useIssueAdminStatus({
  issue: toRef(props, 'issue'),
  derivedStatus,
  emitStatusChanged: (issue) => emit('status-changed', issue),
  emitMessage: (message) => emit('message', message),
  emitError: (error) => emit('error', error),
  emitDropdownOpen: (open) => emit('dropdown-open', open),
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

function closeRejectionDialog() {
  if (isRejecting.value) return;
  isRejectionDialogOpen.value = false;
  rejectionError.value = '';
}

function selectStatus(status: IssueStatus) {
  if (status === 'review-rejected') {
    isDropdownOpen.value = false;
    rejectionReason.value = props.issue.review_rejection_reason ?? '';
    rejectionError.value = '';
    isRejectionDialogOpen.value = true;
    return;
  }
  void updateStatus(status);
}

async function submitRejection() {
  const reason = rejectionReason.value.replace(/\s+/g, ' ').trim();
  if (!reason) {
    rejectionError.value = '請輸入審核未通過原因。';
    return;
  }
  isRejecting.value = true;
  rejectionError.value = '';
  try {
    await updateStatus('review-rejected', reason);
    isRejectionDialogOpen.value = false;
  } finally {
    isRejecting.value = false;
  }
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
