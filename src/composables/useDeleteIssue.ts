import { ref, unref, type MaybeRef } from 'vue';
import { deleteIssue } from '@/services/issues';

export function useDeleteIssue(issueId: MaybeRef<string>) {
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

  async function performDelete(purgeNestedCollections = true) {
    isDeleting.value = true;
    const targetIssueId = unref(issueId);

    try {
      const result = await deleteIssue(targetIssueId, { purgeNestedCollections });
      isDeleteDialogOpen.value = false;
      return result.issueId;
    } catch {
      actionError.value = '刪除失敗，請稍後再試。';
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
