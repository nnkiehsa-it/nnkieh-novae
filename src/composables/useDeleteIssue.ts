import { ref, unref, type MaybeRef } from 'vue';
import { deleteIssue } from '@/services/issues';
import { useActionFeedback } from '@/composables/useActionFeedback';

export function useDeleteIssue(issueId: MaybeRef<string>) {
  const { start } = useActionFeedback();
  const isDeleteDialogOpen = ref(false);
  const isDeleting = ref(false);
  const actionError = ref('');
  const actionMessage = ref('');

  function confirmDelete() {
    actionError.value = '';
    actionMessage.value = '';
    isDeleteDialogOpen.value = true;
  }

  function closeDeleteDialog() {
    if (isDeleting.value) {
      return;
    }
    isDeleteDialogOpen.value = false;
  }

  async function performDelete() {
    isDeleting.value = true;
    const targetIssueId = unref(issueId);
    const feedbackHandle = start('正在刪除提案');

    try {
      const result = await deleteIssue(targetIssueId);
      isDeleteDialogOpen.value = false;
      feedbackHandle.succeed('提案已刪除');
      return result.issueId;
    } catch {
      actionError.value = '刪除失敗，請稍後再試。';
      feedbackHandle.fail(actionError.value);
      return '';
    } finally {
      isDeleting.value = false;
    }
  }

  return {
    isDeleteDialogOpen,
    isDeleting,
    actionError,
    actionMessage,
    confirmDelete,
    closeDeleteDialog,
    performDelete,
  };
}
