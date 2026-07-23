import { computed, onScopeDispose, ref, watch, type Ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { returnToNavigationOrigin } from '@/router/navigation-hierarchy';
import { registerAppResumeHandler } from '@/composables/useAppResume';
import { useActionFeedback } from '@/composables/useActionFeedback';
import { useDetailRouteQuery } from '@/composables/useDetailRouteQuery';
import { useNetworkStatus } from '@/composables/useNetworkStatus';
import { useSession } from '@/composables/useSession';
import { useShareUrl } from '@/composables/useShareUrl';
import { normalizeRouteParam } from '@/lib/route';
import {
  createContentCacheKey,
  getCachedContentEntry,
  markContentRealtimeReliable,
  markContentRealtimeUnreliable,
  markContentWentOffline,
  patchCachedContent,
  shouldRefreshContentAfterResume,
} from '@/services/content-read-cache';
import { subscribeContentRevisionChanges } from '@/services/content-revisions';
import {
  deleteAnnouncement,
  fetchAnnouncementRecordById,
  setAnnouncementLike,
} from '@/services/announcements';
import { subscribeContentRealtimeEvents } from '@/services/realtime-events';
import type { AnnouncementRecord } from '@/types';

export function useAnnouncementDetail(canLoad: Ref<boolean>) {
  const route = useRoute();
  const router = useRouter();
  const { can, roleLoading, user } = useSession();
  const { show, start } = useActionFeedback();
  const { isOnline } = useNetworkStatus();
  const { copyRouteUrl } = useShareUrl();

  const announcement = ref<AnnouncementRecord | null>(null);
  const loading = ref(false);
  const liking = ref(false);
  const deleting = ref(false);
  const deleteDialogOpen = ref(false);
  const isAdmin = computed(() => can('announcement.manage'));
  const { focusCommentId, initialTab } = useDetailRouteQuery();
  const detailCacheScope = computed(() => createContentCacheKey([
    user.value?.uid ?? '',
    isAdmin.value ? 'admin' : 'user',
  ]));
  let requestId = 0;
  let realtimeUnsubscribe: (() => void) | null = null;
  let realtimeRefreshTimer = 0;

  function detailCacheKey(announcementId: string) {
    return createContentCacheKey(['announcement-detail', announcementId, detailCacheScope.value]);
  }

  function goBack() {
    requestId += 1;
    if (returnToNavigationOrigin(router)) return;
    void router.replace({ name: 'announcements' });
  }

  function copyUrl() {
    if (!announcement.value) return;
    void copyRouteUrl({
      name: 'announcement-detail',
      params: { announcementId: announcement.value.id },
    });
  }

  function openDeleteDialog() {
    deleteDialogOpen.value = true;
  }

  function closeDeleteDialog() {
    if (!deleting.value) deleteDialogOpen.value = false;
  }

  async function confirmDelete() {
    if (!announcement.value) return;
    deleting.value = true;
    const feedback = start('announcement.announcementBeingDeleted');
    try {
      await deleteAnnouncement(announcement.value.id);
      deleteDialogOpen.value = false;
      feedback.succeed('announcement.announcementHasBeenDeleted');
      goBack();
    } catch (caught) {
      feedback.fail(caught instanceof Error ? caught.message : 'announcement.announcementDeletionFailed');
    } finally {
      deleting.value = false;
    }
  }

  async function toggleLike() {
    if (!announcement.value || liking.value) return;

    const current = announcement.value;
    const previousLiked = current.currentUserLiked;
    const previousLikeCount = current.like_count;
    const nextLiked = !previousLiked;
    liking.value = true;
    announcement.value = {
      ...current,
      currentUserLiked: nextLiked,
      like_count: Math.max(0, previousLikeCount + (nextLiked ? 1 : -1)),
    };
    try {
      const result = await setAnnouncementLike(current.id, nextLiked);
      if (announcement.value?.id !== current.id) return;
      announcement.value = {
        ...announcement.value,
        currentUserLiked: result.liked,
        like_count: result.like_count,
      };
      patchCachedContent<AnnouncementRecord>(
        detailCacheKey(current.id),
        (cached) => ({
          ...cached,
          currentUserLiked: result.liked,
          like_count: result.like_count,
        }),
      );
    } catch (caught) {
      if (announcement.value?.id === current.id) {
        announcement.value = {
          ...announcement.value,
          currentUserLiked: previousLiked,
          like_count: previousLikeCount,
        };
      }
      show(caught instanceof Error ? caught.message : 'facility.operationFailedPleaseTryAgainLater', 'error');
    } finally {
      liking.value = false;
    }
  }

  function updateCommentCount(payload: { announcementId: string; commentCount: number }) {
    if (announcement.value?.id !== payload.announcementId) return;
    announcement.value = { ...announcement.value, comment_count: payload.commentCount };
    patchCachedContent<AnnouncementRecord>(
      detailCacheKey(payload.announcementId),
      (cached) => ({ ...cached, comment_count: payload.commentCount }),
    );
  }

  async function refresh(options: { force?: boolean } = {}) {
    const current = announcement.value;
    if (!current) return;
    const currentRequestId = ++requestId;
    try {
      const fetched = await fetchAnnouncementRecordById(current.id, {
        cacheScope: detailCacheScope.value,
        forceRefresh: options.force === true,
      });
      if (currentRequestId !== requestId) return;
      announcement.value = {
        ...fetched,
        currentUserLiked: announcement.value?.currentUserLiked ?? fetched.currentUserLiked,
      };
      markContentRealtimeReliable();
    } catch (caught) {
      if (currentRequestId !== requestId) return;
      show(caught instanceof Error ? caught.message : 'announcement.thisAnnouncementCannotBeFoundMessage', 'error');
      goBack();
    }
  }

  function scheduleRealtimeRefresh() {
    window.clearTimeout(realtimeRefreshTimer);
    realtimeRefreshTimer = window.setTimeout(() => void refresh({ force: true }), 300);
  }

  const unregisterResumeHandler = registerAppResumeHandler(() => {
    const announcementId = normalizeRouteParam(route.params.announcementId);
    if (!canLoad.value || !announcementId) return;
    const cached = getCachedContentEntry<AnnouncementRecord>(detailCacheKey(announcementId));
    if (shouldRefreshContentAfterResume(cached?.updatedAt ?? 0)) void refresh({ force: true });
  });
  const unsubscribeRevision = subscribeContentRevisionChanges('announcements', () => {
    if (canLoad.value && announcement.value) return refresh({ force: true });
  });

  watch(
    [canLoad, () => route.params.announcementId],
    async ([allowed, rawAnnouncementId]) => {
      if (!allowed) return;
      const announcementId = normalizeRouteParam(rawAnnouncementId);
      if (!announcementId) {
        goBack();
        return;
      }
      const currentRequestId = ++requestId;
      loading.value = true;
      try {
        const fetched = await fetchAnnouncementRecordById(announcementId, {
          cacheScope: detailCacheScope.value,
        });
        if (currentRequestId === requestId) announcement.value = fetched;
      } catch (caught) {
        if (currentRequestId !== requestId) return;
        show(caught instanceof Error ? caught.message : 'announcement.thisAnnouncementCannotBeFoundMessage', 'error');
        goBack();
      } finally {
        if (currentRequestId === requestId) loading.value = false;
      }
    },
    { immediate: true },
  );

  watch(
    () => [canLoad.value, route.params.announcementId, roleLoading.value] as const,
    ([allowed, rawAnnouncementId, waitingForRole]) => {
      realtimeUnsubscribe?.();
      realtimeUnsubscribe = null;
      window.clearTimeout(realtimeRefreshTimer);
      if (!allowed || waitingForRole) return;
      const announcementId = normalizeRouteParam(rawAnnouncementId);
      if (!announcementId) return;

      realtimeUnsubscribe = subscribeContentRealtimeEvents(`announcement-detail:${announcementId}`, (event) => {
        if (event.eventType === 'announcement_metrics_changed' && event.targetId === announcementId) {
          if (announcement.value) {
            announcement.value = {
              ...announcement.value,
              comment_count: event.commentCount ?? announcement.value.comment_count,
              like_count: event.likeCount ?? announcement.value.like_count,
            };
          }
          patchCachedContent<AnnouncementRecord>(
            detailCacheKey(announcementId),
            (cached) => ({
              ...cached,
              comment_count: event.commentCount ?? cached.comment_count,
              like_count: event.likeCount ?? cached.like_count,
            }),
          );
          return;
        }
        if (event.eventType === 'announcement_changed' && event.targetId === announcementId) {
          scheduleRealtimeRefresh();
        }
      }, markContentRealtimeUnreliable, scheduleRealtimeRefresh);
    },
    { immediate: true },
  );

  watch(isOnline, (online) => {
    if (!online) {
      markContentWentOffline();
      return;
    }
    const announcementId = normalizeRouteParam(route.params.announcementId);
    if (!canLoad.value || !announcementId) return;
    const cached = getCachedContentEntry<AnnouncementRecord>(detailCacheKey(announcementId));
    if (shouldRefreshContentAfterResume(cached?.updatedAt ?? 0)) void refresh({ force: true });
  });

  onScopeDispose(() => {
    realtimeUnsubscribe?.();
    unregisterResumeHandler();
    unsubscribeRevision();
    window.clearTimeout(realtimeRefreshTimer);
  });

  return {
    announcement,
    closeDeleteDialog,
    confirmDelete,
    copyUrl,
    deleteDialogOpen,
    deleting,
    focusCommentId,
    goBack,
    initialTab,
    isAdmin,
    liking,
    loading,
    openDeleteDialog,
    toggleLike,
    updateCommentCount,
  };
}
