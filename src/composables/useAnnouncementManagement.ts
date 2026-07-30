import { computed, onScopeDispose, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAnnouncements } from '@/composables/useAnnouncements';
import { registerAppResumeHandler } from '@/composables/useAppResume';
import { useNetworkStatus } from '@/composables/useNetworkStatus';
import { useSession } from '@/composables/useSession';
import { useActionFeedback } from '@/composables/useActionFeedback';
import {
  deleteAnnouncement,
  fetchAnnouncementRecordById,
  setAnnouncementLike,
} from '@/services/announcements';
import { subscribeContentRealtimeEvents } from '@/services/realtime-events';
import type { AnnouncementRecord } from '@/types';
import { isContentUnavailableError } from '@/services/issues-core';
import {
  markContentRealtimeReliable,
  markContentRealtimeUnreliable,
  markContentWentOffline,
  shouldRefreshContentAfterResume,
} from '@/services/content-read-cache';
import { subscribeContentRevisionChanges } from '@/services/content-revisions';

export function useAnnouncementManagement() {
  const router = useRouter();
  const { can, initialized, isAllowedUser, loading: authLoading, roleLoading, user } = useSession();
  const isAdmin = computed(() => can('announcement.manage'));
  const { show, start } = useActionFeedback();
  const { isOnline } = useNetworkStatus();
  const announcementCacheScope = computed(() => [
    initialized.value ? 'ready' : 'booting',
    isAllowedUser.value ? 'allowed' : 'blocked',
    user.value?.uid ?? '',
    isAdmin.value ? 'admin' : 'user',
  ].join(':'));
  const {
    announcements,
    loading,
    loadingMore,
    updatedAt,
    error,
    hasMore,
    loadMoreAnnouncements,
    forceRefreshAnnouncements,
    patchAnnouncement,
    upsertAnnouncement,
    removeAnnouncement,
    refreshAnnouncements,
    resetAnnouncements,
  } = useAnnouncements({ cacheScope: announcementCacheScope });
  const liking = ref(false);
  const likingAnnouncementId = ref('');
  const deleting = ref(false);
  const deletePendingAnnouncement = ref<AnnouncementRecord | null>(null);
  const sessionLoading = computed(() => authLoading.value || !initialized.value);
  let realtimeUnsubscribe: (() => void) | null = null;
  const unregisterResumeHandler = registerAppResumeHandler(() => {
    if (!initialized.value || !isAllowedUser.value) return;
    if (!shouldRefreshContentAfterResume(updatedAt.value)) return;
    void refreshAnnouncementList({ force: true });
  });
  const unsubscribeRevision = subscribeContentRevisionChanges('announcements', () =>
    refreshAnnouncementList({ force: true })
  );

  function openAnnouncementDetails(announcement: AnnouncementRecord, initialTab: 'details' | 'comments' = 'details') {
    router.push({
      name: 'announcement-detail',
      params: { announcementId: announcement.id },
      query: initialTab === 'comments' ? { tab: 'comments' } : undefined,
    });
  }

  function handleListDelete(announcement: AnnouncementRecord) {
    deletePendingAnnouncement.value = announcement;
  }

  function closeDeleteDialog() {
    if (deleting.value) return;
    deletePendingAnnouncement.value = null;
  }

  async function confirmDelete() {
    const announcement = deletePendingAnnouncement.value;
    if (!announcement) return;

    deleting.value = true;
    const feedbackHandle = start('announcement.announcementBeingDeleted');
    try {
      await deleteAnnouncement(announcement.id);
      removeAnnouncement(announcement.id);
      deletePendingAnnouncement.value = null;
      feedbackHandle.succeed('announcement.announcementHasBeenDeleted');
    } catch (caught) {
      feedbackHandle.fail(caught instanceof Error ? caught.message : 'announcement.announcementDeletionFailed');
    } finally {
      deleting.value = false;
    }
  }

  async function handleToggleLike(announcement: AnnouncementRecord | null) {
    if (!announcement) return;
    if (!isAllowedUser.value) {
      show('announcement.signInToLikeThisAnnouncement', 'error');
      return;
    }
    if (liking.value) return;

    const previousLiked = announcement.currentUserLiked;
    const previousLikeCount = announcement.like_count;
    const nextLiked = !previousLiked;
    const nextLikeCount = Math.max(0, previousLikeCount + (nextLiked ? 1 : -1));
    liking.value = true;
    likingAnnouncementId.value = announcement.id;
    patchAnnouncement(announcement.id, (item) => ({
      ...item,
      currentUserLiked: nextLiked,
      like_count: nextLikeCount,
    }));
    try {
      const result = await setAnnouncementLike(announcement.id, nextLiked);
      patchAnnouncement(announcement.id, (item) => ({
        ...item,
        currentUserLiked: result.liked,
        like_count: result.like_count,
      }));
    } catch (caught) {
      patchAnnouncement(announcement.id, (item) => ({
        ...item,
        currentUserLiked: previousLiked,
        like_count: previousLikeCount,
      }));
      if (isContentUnavailableError(caught)) {
        handleAnnouncementUnavailable(announcement.id);
      }
      show(caught instanceof Error ? caught.message : 'facility.operationFailedPleaseTryAgainLater', 'error');
    } finally {
      liking.value = false;
      likingAnnouncementId.value = '';
    }
  }

  function handleAnnouncementUnavailable(announcementId: string) {
    removeAnnouncement(announcementId);
  }

  async function refreshAnnouncementList(options: { force?: boolean } = {}) {
    if (options.force) {
      await forceRefreshAnnouncements();
      markContentRealtimeReliable();
      return;
    }
    await refreshAnnouncements();
  }

  watch(
    [initialized, isAllowedUser],
    ([ready, allowed]) => {
      if (!ready) return;
      if (allowed) {
        void refreshAnnouncementList();
        return;
      }
      resetAnnouncements();
    },
    { immediate: true },
  );

  watch(
    [initialized, isAllowedUser, roleLoading],
    ([ready, allowed, waitingForRole]) => {
      realtimeUnsubscribe?.();
      realtimeUnsubscribe = null;
      if (!ready || !allowed || waitingForRole) return;

      realtimeUnsubscribe = subscribeContentRealtimeEvents('announcements', (event) => {
        if (event.eventType === 'announcement_metrics_changed') {
          patchAnnouncement(event.targetId, (announcement) => ({
            ...announcement,
            comment_count: event.commentCount ?? announcement.comment_count,
            like_count: event.likeCount ?? announcement.like_count,
          }));
          return;
        }
        if (event.eventType !== 'announcement_changed') return;
        if (event.op === 'delete') {
          removeAnnouncement(event.targetId);
          return;
        }
        void fetchAnnouncementRecordById(event.targetId, {
          cacheScope: announcementCacheScope.value,
          forceRefresh: true,
        }).then((announcement) => {
          upsertAnnouncement(announcement);
        }).catch((caught) => {
          if (isContentUnavailableError(caught)) removeAnnouncement(event.targetId);
        });
      }, () => {
        markContentRealtimeUnreliable();
        void refreshAnnouncementList({ force: true });
      }, () => { void refreshAnnouncementList({ force: true }); });
    },
    { immediate: true },
  );

  onScopeDispose(() => {
    realtimeUnsubscribe?.();
    unregisterResumeHandler();
    unsubscribeRevision();
  });

  watch(isOnline, (online) => {
    if (!online) {
      markContentWentOffline();
      return;
    }
    if (!initialized.value || !isAllowedUser.value) return;
    if (shouldRefreshContentAfterResume(updatedAt.value)) void refreshAnnouncementList({ force: true });
  });

  return {
    announcements,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMoreAnnouncements,
    refreshAnnouncements: () => refreshAnnouncementList({ force: true }),
    liking,
    likingAnnouncementId,
    deleting,
    deletePendingAnnouncement,
    sessionLoading,
    isAdmin,
    isAllowedUser,
    openAnnouncementDetails,
    handleListDelete,
    closeDeleteDialog,
    confirmDelete,
    handleToggleLike,
  };
}
