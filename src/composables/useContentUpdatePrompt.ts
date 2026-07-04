import { computed, onScopeDispose, ref, watch, type Ref } from 'vue';
import { useSession } from '@/composables/useSession';
import { subscribeContentUpdateNotifications, type ContentUpdateNotification } from '@/services/notifications';
import type { IssueStatusBucket } from '@/types';

function useContentUpdateSubscription(handler: (notification: ContentUpdateNotification) => void) {
  const { isAllowedUser, user } = useSession();
  let unsubscribe: (() => void) | null = null;

  function stopSubscription() {
    unsubscribe?.();
    unsubscribe = null;
  }

  watch(
    [() => user.value?.uid ?? '', isAllowedUser],
    ([uid, allowed]) => {
      stopSubscription();
      if (!uid || !allowed) return;
      unsubscribe = subscribeContentUpdateNotifications(uid, handler);
    },
    { immediate: true },
  );

  onScopeDispose(stopSubscription);
}

export function useIssueListUpdatePrompt(
  activeFilter: Ref<string>,
  statusTab: Ref<IssueStatusBucket>,
) {
  const { user } = useSession();
  const hasNewIssue = ref(false);
  const showIssueUpdatePrompt = computed(() =>
    hasNewIssue.value
    && activeFilter.value !== 'my-proposals'
    && statusTab.value === 'active'
  );

  useContentUpdateSubscription((notification) => {
    if (notification.kind !== 'issue') return;
    if (notification.actorUid === user.value?.uid) return;
    if (notification.category !== activeFilter.value) return;
    if (statusTab.value !== 'active') return;
    hasNewIssue.value = true;
  });

  function acknowledgeIssueListUpdate() {
    hasNewIssue.value = false;
  }

  watch([activeFilter, statusTab], acknowledgeIssueListUpdate);

  return {
    acknowledgeIssueListUpdate,
    showIssueUpdatePrompt,
  };
}

export function useAnnouncementListUpdatePrompt() {
  const { user } = useSession();
  const showAnnouncementUpdatePrompt = ref(false);

  useContentUpdateSubscription((notification) => {
    if (notification.kind !== 'announcement') return;
    if (notification.actorUid === user.value?.uid) return;
    showAnnouncementUpdatePrompt.value = true;
  });

  function acknowledgeAnnouncementListUpdate() {
    showAnnouncementUpdatePrompt.value = false;
  }

  return {
    acknowledgeAnnouncementListUpdate,
    showAnnouncementUpdatePrompt,
  };
}
