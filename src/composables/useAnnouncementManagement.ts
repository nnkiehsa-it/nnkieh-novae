import { computed, onScopeDispose, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAnnouncements } from '@/composables/useAnnouncements';
import { useSession } from '@/composables/useSession';
import { useToast } from '@/composables/useToast';
import {
  createAnnouncement,
  deleteAnnouncement,
  setAnnouncementLike,
  updateAnnouncement,
} from '@/services/announcements';
import { subscribeContentRealtimeEvents } from '@/services/realtime-events';
import { deleteUploadedImage } from '@/services/uploads';
import type { UploadedImage } from '@/composables/useImageUpload';
import type { AnnouncementRecord, AnnouncementSortOption } from '@/types';
import { isContentUnavailableError } from '@/services/issues-core';

export function useAnnouncementManagement() {
  const router = useRouter();
  const { initialized, isAdmin, isAllowedUser, loading: authLoading, roleLoading } = useSession();
  const { showToast } = useToast();
  const sortOption = ref<AnnouncementSortOption>('latest');
  const {
    announcements,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMoreAnnouncements,
    patchAnnouncement,
    removeAnnouncement,
    refreshAnnouncements,
    resetAnnouncements,
  } = useAnnouncements({ sortOption });
  const editingAnnouncement = ref<AnnouncementRecord | null>(null);
  const editorError = ref('');
  const editorOpen = ref(false);
  const liking = ref(false);
  const likingAnnouncementId = ref('');
  const saving = ref(false);
  const deleting = ref(false);
  const deletePendingAnnouncement = ref<AnnouncementRecord | null>(null);
  const sessionLoading = computed(() => authLoading.value || !initialized.value);
  let realtimeUnsubscribe: (() => void) | null = null;
  let realtimeRefreshTimer = 0;

  function openAnnouncementDetails(announcement: AnnouncementRecord, initialTab: 'details' | 'comments' = 'details') {
    router.push({
      name: 'announcement-detail',
      params: { announcementId: announcement.id },
      query: initialTab === 'comments' ? { tab: 'comments' } : undefined,
    });
  }

  function openEditor(announcement: AnnouncementRecord | null) {
    editingAnnouncement.value = announcement;
    editorError.value = '';
    editorOpen.value = true;
  }

  function closeEditor() {
    if (saving.value) return;
    editorOpen.value = false;
  }

  async function handleSave(payload: { title: string; content: string; uploadedImages: UploadedImage[] }) {
    saving.value = true;
    editorError.value = '';
    try {
      if (editingAnnouncement.value) {
        await updateAnnouncement(editingAnnouncement.value.id, payload);
      } else {
        await createAnnouncement(payload);
      }
      await refreshAnnouncementList();
      editorOpen.value = false;
      showToast('公告已儲存。', 'success');
    } catch (caught) {
      await Promise.allSettled(payload.uploadedImages.map((image) => deleteUploadedImage(image.storagePath)));
      editorError.value = caught instanceof Error ? caught.message : '公告儲存失敗。';
      showToast(editorError.value, 'error');
    } finally {
      saving.value = false;
    }
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
    try {
      await deleteAnnouncement(announcement.id);
      removeAnnouncement(announcement.id);
      deletePendingAnnouncement.value = null;
      showToast('公告已刪除。', 'success');
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : '公告刪除失敗。', 'error');
    } finally {
      deleting.value = false;
    }
  }

  async function handleToggleLike(announcement: AnnouncementRecord | null) {
    if (!announcement) return;
    if (!isAllowedUser.value) {
      showToast('請先使用校內帳號登入後再按讚。', 'error');
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
      showToast(caught instanceof Error ? caught.message : '操作失敗，請稍後再試。', 'error');
    } finally {
      liking.value = false;
      likingAnnouncementId.value = '';
    }
  }

  function handleAnnouncementUnavailable(announcementId: string) {
    removeAnnouncement(announcementId);
  }

  async function refreshAnnouncementList() {
    await refreshAnnouncements();
  }

  function scheduleRealtimeRefresh() {
    window.clearTimeout(realtimeRefreshTimer);
    realtimeRefreshTimer = window.setTimeout(() => {
      void refreshAnnouncementList();
    }, 300);
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
    [initialized, isAllowedUser, roleLoading, () => sortOption.value],
    ([ready, allowed, waitingForRole]) => {
      realtimeUnsubscribe?.();
      realtimeUnsubscribe = null;
      window.clearTimeout(realtimeRefreshTimer);
      if (!ready || !allowed || waitingForRole) return;

      realtimeUnsubscribe = subscribeContentRealtimeEvents(`announcements:${sortOption.value}`, (event) => {
        if (event.eventType === 'announcement_metrics_changed') {
          patchAnnouncement(event.targetId, (announcement) => ({
            ...announcement,
            comment_count: event.commentCount ?? announcement.comment_count,
            like_count: event.likeCount ?? announcement.like_count,
          }));
          return;
        }
        if (event.eventType !== 'announcement_changed') return;
        scheduleRealtimeRefresh();
      });
    },
    { immediate: true },
  );

  onScopeDispose(() => {
    realtimeUnsubscribe?.();
    window.clearTimeout(realtimeRefreshTimer);
  });

  return {
    announcements,
    sortOption,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMoreAnnouncements,
    refreshAnnouncements: refreshAnnouncementList,
    editingAnnouncement,
    editorError,
    editorOpen,
    liking,
    likingAnnouncementId,
    saving,
    deleting,
    deletePendingAnnouncement,
    sessionLoading,
    isAdmin,
    isAllowedUser,
    openAnnouncementDetails,
    openEditor,
    closeEditor,
    handleSave,
    handleListDelete,
    closeDeleteDialog,
    confirmDelete,
    handleToggleLike,
  };
}
