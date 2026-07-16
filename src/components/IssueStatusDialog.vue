<template>
  <StatusTransitionDialog
    dialog-title-id="status-dialog-title"
    :open="open"
    :saving="saving"
    :error="errorMsg"
    :options="availableStatusOptions"
    :initial-status="initialStatus"
    :initial-result="issue.result_content ?? ''"
    select-title="更新提案狀態"
    result-title="填寫提案結果"
    result-description="結案時請填寫使用者看得到的處理結果。"
    result-input-id="closed-result-content"
    result-label="提案結果說明"
    :result-max-length="INPUT_LIMITS.resultContent"
    :result-warning-length="1800"
    result-placeholder="請輸入提案結果說明（例如實行方式、預計時程或無法辦理的原因）"
    result-required-error="請輸入提案結果說明。"
    :result-statuses="['completed', 'infeasible']"
    :status-warnings="statusWarnings"
    @close="emit('close')"
    @submit="save"
  />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import StatusTransitionDialog from '@/components/ui/StatusTransitionDialog.vue';
import { INPUT_LIMITS } from '@/constants/input-limits';
import { useActionFeedback } from '@/composables/useActionFeedback';
import { moderateIssueStatus, updateIssueResult } from '@/services/issues';
import type { IssueRecord, IssueStatus } from '@/types';

type EditableStatus = Extract<IssueStatus, 'processing' | 'completed' | 'infeasible'>;

const props = withDefaults(defineProps<{
  open: boolean;
  issue: IssueRecord;
  initialAction?: 'processing' | 'closed';
}>(), {
  initialAction: 'processing',
});

const emit = defineEmits<{
  close: [];
  success: [issue: IssueRecord];
}>();

const statusOptions = [
  { value: 'processing', label: '處理中', description: '提案已開始處理，尚未有最終結果。' },
  { value: 'completed', label: '已完成', description: '提案已實行或已有明確完成結果。' },
  { value: 'infeasible', label: '無法實行', description: '提案經評估後無法辦理，需說明原因。' },
] satisfies Array<{ value: EditableStatus; label: string; description: string }>;

const availableStatusOptions = computed(() =>
  props.issue.status === 'processing'
    ? statusOptions.filter((option) => option.value !== 'processing')
    : statusOptions,
);
const initialStatus = computed<EditableStatus>(() => {
  if (props.issue.status === 'processing') return 'completed';
  if (props.initialAction === 'closed') {
    return props.issue.status === 'infeasible' ? 'infeasible' : 'completed';
  }
  if (props.issue.status === 'completed' || props.issue.status === 'infeasible') {
    return props.issue.status;
  }
  return 'processing';
});
const statusWarnings = computed<Record<string, string>>(() => {
  const warnings: Record<string, string> = {};
  if (props.issue.result_content) {
    warnings.processing = '改為處理中會清除目前的提案結果說明。';
  }
  return warnings;
});
const saving = ref(false);
const errorMsg = ref('');
const { start } = useActionFeedback();

async function save(rawStatus: string, resultContent: string) {
  const nextStatus = rawStatus as EditableStatus;
  saving.value = true;
  errorMsg.value = '';
  const feedback = start('正在更新提案狀態');
  try {
    if (nextStatus === 'processing') {
      let finalIssue = await moderateIssueStatus(props.issue.id, nextStatus);
      if (props.issue.result_content) {
        finalIssue = await updateIssueResult(props.issue.id, '');
      }
      emit('success', finalIssue);
      feedback.succeed('提案狀態已更新');
    } else {
      const updated = await moderateIssueStatus(props.issue.id, nextStatus);
      const finalIssue = await updateIssueResult(props.issue.id, resultContent);
      emit('success', finalIssue);
      feedback.succeed('提案狀態與結果已更新');
    }
    emit('close');
  } catch (caught) {
    errorMsg.value = caught instanceof Error ? caught.message : '更新失敗，請稍後再試。';
    feedback.fail(errorMsg.value);
  } finally {
    saving.value = false;
  }
}
</script>
