import { ref, watch, type ComputedRef } from 'vue';
import {
  listScopeMembers,
  lookupAccessMember,
  setUserAccessScope,
  type AccessScope,
  type AccessUser,
} from '@/services/access';

export function useMemberAccessManagement(scope: ComputedRef<AccessScope | null>) {
  const assignees = ref<AccessUser[]>([]);
  const membersLoading = ref(false);
  const membersTruncated = ref(false);
  const memberError = ref('');
  const lookupCandidate = ref<AccessUser | null>(null);
  const lookupLoading = ref(false);
  const lookupError = ref('');
  const lookupAttempted = ref(false);
  const savingUid = ref('');
  let assigneeRequestSequence = 0;
  let lookupRequestSequence = 0;

  function resetLookup() {
    lookupCandidate.value = null;
    lookupError.value = '';
    lookupAttempted.value = false;
    lookupLoading.value = false;
    lookupRequestSequence += 1;
  }

  async function loadAssignees() {
    const selectedScope = scope.value;
    const requestSequence = ++assigneeRequestSequence;
    assignees.value = [];
    membersTruncated.value = false;
    memberError.value = '';
    if (!selectedScope) {
      membersLoading.value = false;
      return;
    }
    membersLoading.value = true;
    try {
      const result = await listScopeMembers(selectedScope);
      if (requestSequence !== assigneeRequestSequence) return;
      assignees.value = result.users;
      membersTruncated.value = result.truncated;
    } catch (caught) {
      if (requestSequence === assigneeRequestSequence) {
        memberError.value = caught instanceof Error ? caught.message : 'access.theSearchFailed';
      }
    } finally {
      if (requestSequence === assigneeRequestSequence) membersLoading.value = false;
    }
  }

  async function lookupMember(query: string) {
    const trimmedQuery = query.trim();
    if (!trimmedQuery || !scope.value || lookupLoading.value) return;
    const requestSequence = ++lookupRequestSequence;
    lookupLoading.value = true;
    lookupError.value = '';
    lookupAttempted.value = true;
    lookupCandidate.value = null;
    try {
      const result = await lookupAccessMember(trimmedQuery);
      if (requestSequence !== lookupRequestSequence) return;
      lookupCandidate.value = result.users[0] ?? null;
    } catch (caught) {
      if (requestSequence === lookupRequestSequence) {
        lookupError.value = caught instanceof Error ? caught.message : 'access.theSearchFailed';
      }
    } finally {
      if (requestSequence === lookupRequestSequence) lookupLoading.value = false;
    }
  }

  async function saveAccess(accessUser: AccessUser, grant: boolean) {
    const selectedScope = scope.value;
    if (!selectedScope) return false;
    savingUid.value = accessUser.uid;
    memberError.value = '';
    try {
      const result = await setUserAccessScope(accessUser.uid, selectedScope, grant);
      const updated = { ...accessUser, ...result };
      assignees.value = grant
        ? assignees.value.some((member) => member.uid === updated.uid)
          ? assignees.value.map((member) => member.uid === updated.uid ? updated : member)
          : [...assignees.value, updated]
        : assignees.value.filter((member) => member.uid !== updated.uid);
      if (lookupCandidate.value?.uid === updated.uid) lookupCandidate.value = updated;
      return true;
    } catch (caught) {
      memberError.value = caught instanceof Error ? caught.message : 'access.saveFailed';
      return false;
    } finally {
      savingUid.value = '';
    }
  }

  watch(scope, () => {
    resetLookup();
    void loadAssignees();
  }, { immediate: true });

  return {
    assignees,
    grantAccess: (accessUser: AccessUser) => saveAccess(accessUser, true),
    loadAssignees,
    lookupAttempted,
    lookupCandidate,
    lookupError,
    lookupLoading,
    lookupMember,
    memberError,
    membersLoading,
    membersTruncated,
    resetLookup,
    revokeAccess: (accessUser: AccessUser) => saveAccess(accessUser, false),
    savingUid,
  };
}
