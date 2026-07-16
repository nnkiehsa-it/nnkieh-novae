<template>
  <StatusTransitionDialog
    dialog-title-id="facility-status-dialog-title"
    :open="open"
    :saving="saving"
    :error="error"
    :options="availableOptions"
    :initial-status="availableOptions[0]?.value ?? ''"
    select-title="更新設備狀態"
    result-title="填寫設備處理結果"
    result-description="結案時請填寫使用者看得到的處理結果。"
    result-input-id="facility-result-content"
    result-label="處理結果"
    :result-max-length="INPUT_LIMITS.resultContent"
    :result-warning-length="1800"
    result-placeholder="請說明處理結果或無法處理的原因"
    result-required-error="請填寫處理結果。"
    :result-statuses="['completed', 'unable-to-handle']"
    @close="emit('close')"
    @submit="submit"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import StatusTransitionDialog from '@/components/ui/StatusTransitionDialog.vue';
import { INPUT_LIMITS } from '@/constants/input-limits';
import type { FacilityStatus } from '@/types';

const props = withDefaults(defineProps<{
  currentStatus: FacilityStatus;
  error?: string;
  open: boolean;
  saving?: boolean;
}>(), {
  error: '',
  saving: false,
});

const emit = defineEmits<{
  close: [];
  submit: [status: FacilityStatus, result: string];
}>();

const options = [
  { value: 'processing', label: '處理中', description: '設備問題已開始處理，尚未有最終結果。' },
  { value: 'completed', label: '已完成', description: '設備問題已處理完成，需填寫處理結果。' },
  { value: 'unable-to-handle', label: '無法處理', description: '經評估後無法處理，需說明原因。' },
] satisfies Array<{ value: FacilityStatus; label: string; description: string }>;

const availableOptions = computed(() =>
  props.currentStatus === 'pending'
    ? options.filter((option) => option.value === 'processing')
    : options.filter((option) => option.value !== 'processing'),
);

function submit(status: string, result: string) {
  emit('submit', status as FacilityStatus, result);
}
</script>
