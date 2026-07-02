import { onBeforeUnmount, ref, watch, type Ref } from 'vue';
import { useSession } from '@/composables/useSession';
import { moderateIssueStatus } from '@/services/issues';
import type { IssueRecord, IssueStatus } from '@/types';
import type { ComputedRef } from 'vue';
import { ISSUE_STATUS_LABELS } from '@/constants/statuses';

interface IssueAdminStatusOptions {
  issue: Ref<IssueRecord>;
  derivedStatus: ComputedRef<IssueStatus>;
  emitStatusChanged: (issue: IssueRecord) => void;
  emitMessage: (message: string) => void;
  emitError: (error: string) => void;
  emitDropdownOpen: (isOpen: boolean) => void;
}

export function useIssueAdminStatus(options: IssueAdminStatusOptions) {
  const { isAdmin } = useSession();
  const adminStatus = ref<IssueStatus>(options.derivedStatus.value);
  const isDropdownOpen = ref(false);

  function closeDropdown() {
    isDropdownOpen.value = false;
  }

  watch(isDropdownOpen, (open) => {
    options.emitDropdownOpen(open);
    if (open) {
      window.addEventListener('click', closeDropdown);
    } else {
      window.removeEventListener('click', closeDropdown);
    }
  });

  watch(
    () => options.issue.value.status,
    () => {
      adminStatus.value = options.derivedStatus.value;
    }
  );

  onBeforeUnmount(() => {
    window.removeEventListener('click', closeDropdown);
  });

  async function updateStatus(nextStatus: IssueStatus, reason?: string) {
    options.emitError('');
    options.emitMessage('');

    if (!isAdmin.value) {
      options.emitError('只有管理員可以調整提案狀態。');
      return;
    }
    if (nextStatus === adminStatus.value) {
      return;
    }
    if (nextStatus === 'auto-rejected') {
      options.emitError('管理員不能手動將提案設為未通過。');
      return;
    }

    const previousStatus = adminStatus.value;
    adminStatus.value = nextStatus;

    try {
      const issue = await moderateIssueStatus(options.issue.value.id, nextStatus, reason);
      options.emitStatusChanged(issue);
      options.emitMessage(`狀態已更新為「${ISSUE_STATUS_LABELS[issue.status]}」。`);
    } catch {
      adminStatus.value = previousStatus;
      options.emitError('狀態更新失敗，請稍後再試。');
    }
  }

  function selectStatus(status: IssueStatus) {
    isDropdownOpen.value = false;
    void updateStatus(status);
  }

  return {
    isAdmin,
    adminStatus,
    isDropdownOpen,
    closeDropdown,
    updateStatus,
    selectStatus,
  };
}
