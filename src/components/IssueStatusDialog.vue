<template>
  <StatusTransitionDialog
    dialog-title-id="status-dialog-title"
    :open="open"
    :saving="saving"
    :saving-state="feedbackPhase"
    :error="errorMsg"
    :options="availableStatusOptions"
    :initial-status="initialStatus"
    :initial-result="issue.result_content ?? ''"
    select-title="issue.changeProposalStatus"
    result-title="issue.addProposalResult"
    result-description="facility.describeTheResultSoUsersUnderstandWhatHappened"
    result-input-id="closed-result-content"
    result-label="issue.result"
    :result-max-length="INPUT_LIMITS.resultContent"
    :result-warning-length="1800"
    result-placeholder="issue.describeTheProposalResult"
    result-required-error="issue.enterTheProposalResult"
    :result-statuses="['completed', 'infeasible']"
    :status-warnings="statusWarnings"
    @close="emit('close')"
    @submit="save"
  />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import StatusTransitionDialog from '@/components/ui/organisms/StatusTransitionDialog.vue';
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
  { value: 'processing', label: 'facility.processing', description: 'issue.status.processedNotFinal' },
  { value: 'completed', label: 'facility.completed', description: 'issue.status.completedResultHelp' },
  { value: 'infeasible', label: 'issue.notFeasible', description: 'issue.status.rejectionReasonHelp' },
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
    warnings.processing = 'issue.status.processingClearsResult';
  }
  return warnings;
});
const saving = ref(false);
const errorMsg = ref('');
const { start } = useActionFeedback();
const feedbackPhase = ref<'idle' | 'busy' | 'success'>('idle');

async function save(rawStatus: string, resultContent: string) {
  const nextStatus = rawStatus as EditableStatus;
  saving.value = true;
  errorMsg.value = '';
  const feedback = start('issue.updatingProposalStatus');
  feedbackPhase.value = 'busy';
  try {
    if (nextStatus === 'processing') {
      let finalIssue = await moderateIssueStatus(props.issue.id, nextStatus);
      if (props.issue.result_content) {
        finalIssue = await updateIssueResult(props.issue.id, '');
      }
      feedback.succeed('issue.proposalStatusUpdated');
      feedbackPhase.value = 'success';
      await feedback.complete();
      emit('success', finalIssue);
    } else {
      const updated = await moderateIssueStatus(props.issue.id, nextStatus);
      const finalIssue = await updateIssueResult(props.issue.id, resultContent);
      feedback.succeed('issue.proposalStatusAndResultsUpdated');
      feedbackPhase.value = 'success';
      await feedback.complete();
      emit('success', finalIssue);
    }
    emit('close');
  } catch (caught) {
    errorMsg.value = caught instanceof Error ? caught.message : 'facility.updateFailedPleaseTryAgainLater';
    feedback.fail(errorMsg.value);
  } finally {
    feedbackPhase.value = 'idle';
    saving.value = false;
  }
}
</script>
