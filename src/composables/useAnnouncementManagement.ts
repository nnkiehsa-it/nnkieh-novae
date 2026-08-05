import { computed, onScopeDispose, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAnnouncements } from '@/composables/useAnnouncements';
import { useSession } from '@/composables/useSession';
import { useActionFeedback } from '@/composables/useActionFeedback';
import {
  fetchAnnouncementRecordById,
  setAnnouncementLike,
} from '@/services/announcements';
import { subscribeContentRealtimeEvents } from '@/services/realtime-events';
import type { AnnouncementRecord } from '@/types';
import { isContentUnavailableError } from '@/services/issues-core';
import { hasContentVersionGap, registerContentVersion } from '@/services/content-versions';
import { subscribeContentVersionChanges } from '@/services/content-versions';
import { preserveContentListScroll } from '@/lib/content-list-scroll';

export function useAnnouncementManagement() {
  const router = useRouter();
  const { can, initialized, isAllowedUser, loading: authLoading, roleLoading, user } = useSession();
  const isAdmin = computed(() => can('announcement.manage'));
  const { show } = useActionFeedback();
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
  const sessionLoading = computed(() => authLoading.value || !initialized.value);
  let realtimeUnsubscribe: (() => void) | null = null;
  const unsubscribeVersion = subscribeContentVersionChanges('announcements', () =>
    preserveContentListScroll(() => refreshAnnouncementList({ force: true }))
  );

  function openAnnouncementDetails(announcement: AnnouncementRecord, initialTab: 'details' | 'comments' = 'details') {
    router.push({
      name: 'announcement-detail',
      params: { announcementId: announcement.id },
      query: initialTab === 'comments' ? { tab: 'comments' } : undefined,
    });
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
        if (event.eventType === 'announcement_comment_changed') {
          registerContentVersion('announcements', event.version);
          return;
        }
        if (event.version > 0 && hasContentVersionGap('announcements', event.version)) {
          void refreshAnnouncementList({ force: true });
          return;
        }
        if (event.eventType === 'announcement_metrics_changed') {
          patchAnnouncement(event.targetId, (announcement) => ({
            ...announcement,
            comment_count: event.commentCount ?? announcement.comment_count,
            like_count: event.likeCount ?? announcement.like_count,
          }));
          registerContentVersion('announcements', event.version);
          return;
        }
        if (event.eventType !== 'announcement_changed') return;
        if (event.op === 'delete') {
          removeAnnouncement(event.targetId);
          registerContentVersion('announcements', event.version);
          return;
        }
        void fetchAnnouncementRecordById(event.targetId, {
          cacheScope: announcementCacheScope.value,
          forceRefresh: true,
        }).then((announcement) => {
          upsertAnnouncement(announcement);
          registerContentVersion('announcements', event.version);
        }).catch((caught) => {
          if (isContentUnavailableError(caught)) removeAnnouncement(event.targetId);
          else void refreshAnnouncementList({ force: true });
        });
      });
    },
    { immediate: true },
  );

  onScopeDispose(() => {
    realtimeUnsubscribe?.();
    unsubscribeVersion();
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
    sessionLoading,
    isAdmin,
    isAllowedUser,
    openAnnouncementDetails,
    handleToggleLike,
  };
}
