import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAnnouncements } from '@/composables/useAnnouncements';
import { useSession } from '@/composables/useSession';
import { useShareUrl } from '@/composables/useShareUrl';
import { useToast } from '@/composables/useToast';
import { normalizeRouteParam } from '@/lib/route';
import {
  createAnnouncement,
  deleteAnnouncement,
  fetchAnnouncementRecordById,
  setAnnouncementLike,
  updateAnnouncement,
} from '@/services/announcements';
import { deleteUploadedImage } from '@/services/uploads';
import type { UploadedImage } from '@/composables/useImageUpload';
import type { AnnouncementRecord, AnnouncementSortOption } from '@/types';
import { isAbortFailure } from '@/lib/request';
import { isContentUnavailableError } from '@/services/issues-core';

export function useAnnouncementManagement() {
  const route = useRoute();
  const router = useRouter();
  const { initialized, isAdmin, isAllowedUser, loading: authLoading, user } = useSession();
  const { showToast } = useToast();
  const { copyShareUrl } = useShareUrl();
  const sortOption = ref<AnnouncementSortOption>('latest');
  const {
    announcements,
    loading,
    loadingMore,
    refreshing,
    error,
    hasMore,
    loadMoreAnnouncements,
    upsertAnnouncement,
    patchAnnouncement,
    removeAnnouncement,
    refreshAnnouncements,
    resetAnnouncements,
  } = useAnnouncements({ sortOption });
  const selectedAnnouncementId = ref('');
  const selectedAnnouncementInitialTab = ref<'details' | 'comments'>('details');
  const fetchedAnnouncement = ref<AnnouncementRecord | null>(null);
  const editingAnnouncement = ref<AnnouncementRecord | null>(null);
  const editorError = ref('');
  const editorOpen = ref(false);
  const liking = ref(false);
  const likingAnnouncementId = ref('');
  const saving = ref(false);
  const deleting = ref(false);
  const deletePendingAnnouncement = ref<AnnouncementRecord | null>(null);
  const sessionLoading = computed(() => authLoading.value || !initialized.value);
  let announcementRequestId = 0;
  const selectedAnnouncement = computed(() => {
    const listedAnnouncement = announcements.value.find((announcement) =>
      announcement.id === selectedAnnouncementId.value
    );
    if (listedAnnouncement) return listedAnnouncement;
    return fetchedAnnouncement.value?.id === selectedAnnouncementId.value ? fetchedAnnouncement.value : null;
  });

  function closeAnnouncementDetails() {
    announcementRequestId += 1;
    selectedAnnouncementId.value = '';
    selectedAnnouncementInitialTab.value = 'details';
    fetchedAnnouncement.value = null;
    router.replace({ name: 'announcements' });
  }

  function openAnnouncementDetails(announcement: AnnouncementRecord, initialTab: 'details' | 'comments' = 'details') {
    selectedAnnouncementId.value = announcement.id;
    selectedAnnouncementInitialTab.value = initialTab;
    fetchedAnnouncement.value = announcement;
    router.push({
      name: 'announcement-detail',
      params: { announcementId: announcement.id },
    });
  }

  function copySelectedAnnouncementUrl() {
    if (!selectedAnnouncement.value) return;
    const href = router.resolve({
      name: 'announcement-detail',
      params: { announcementId: selectedAnnouncement.value.id },
    }).href;
    copyShareUrl(new URL(href, window.location.origin).toString());
  }

  async function handleAnnouncementRouteError(currentRequestId: number) {
    if (currentRequestId !== announcementRequestId) return;
    selectedAnnouncementId.value = '';
    fetchedAnnouncement.value = null;
    showToast('此頁面已不存在或你沒有權限查看此頁面。', 'error');
    await router.replace({ name: 'announcements' });
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
        const announcement = await updateAnnouncement(editingAnnouncement.value.id, payload);
        upsertAnnouncement({
          ...announcement,
          currentUserLiked: editingAnnouncement.value.currentUserLiked,
          like_count: editingAnnouncement.value.like_count,
          comment_count: editingAnnouncement.value.comment_count,
        });
        if (fetchedAnnouncement.value?.id === announcement.id) {
          fetchedAnnouncement.value = {
            ...fetchedAnnouncement.value,
            ...announcement,
            currentUserLiked: fetchedAnnouncement.value.currentUserLiked,
            like_count: fetchedAnnouncement.value.like_count,
            comment_count: fetchedAnnouncement.value.comment_count,
          };
        }
      } else {
        const announcement = await createAnnouncement(payload);
        upsertAnnouncement(announcement);
      }
      editorOpen.value = false;
      showToast('公告已儲存。', 'success');
    } catch (caught) {
      await Promise.allSettled(payload.uploadedImages.map((image) => deleteUploadedImage(image.storagePath)));
      editorError.value = caught instanceof Error ? caught.message : '公告儲存失敗。';
    } finally {
      saving.value = false;
    }
  }

  function handleDelete() {
    if (!selectedAnnouncement.value) return;
    deletePendingAnnouncement.value = selectedAnnouncement.value;
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
      if (selectedAnnouncementId.value === announcement.id) {
        closeAnnouncementDetails();
      }
      removeAnnouncement(announcement.id);
      if (fetchedAnnouncement.value?.id === announcement.id) {
        fetchedAnnouncement.value = null;
      }
      deletePendingAnnouncement.value = null;
      showToast('公告已刪除。', 'success');
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : '公告刪除失敗。', 'error');
    } finally {
      deleting.value = false;
    }
  }

  async function handleToggleLike(announcement: AnnouncementRecord | null = selectedAnnouncement.value) {
    if (!announcement) return;
    liking.value = true;
    likingAnnouncementId.value = announcement.id;
    try {
      const result = await setAnnouncementLike(announcement.id, !announcement.currentUserLiked);
      if (fetchedAnnouncement.value?.id === announcement.id) {
        fetchedAnnouncement.value = {
          ...fetchedAnnouncement.value,
          currentUserLiked: result.liked,
          like_count: result.like_count,
        };
      }
      announcements.value = announcements.value.map((item) =>
        item.id === announcement.id
          ? { ...item, currentUserLiked: result.liked, like_count: result.like_count }
          : item
      );
    } catch (caught) {
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
    if (fetchedAnnouncement.value?.id === announcementId) {
      fetchedAnnouncement.value = null;
    }
    if (selectedAnnouncementId.value === announcementId) {
      closeAnnouncementDetails();
    }
  }

  function handleCommentCountChanged(payload: { announcementId: string; commentCount: number }) {
    if (fetchedAnnouncement.value?.id === payload.announcementId) {
      fetchedAnnouncement.value = {
        ...fetchedAnnouncement.value,
        comment_count: payload.commentCount,
      };
    }
    patchAnnouncement(payload.announcementId, (announcement) => ({
      ...announcement,
      comment_count: payload.commentCount,
    }));
  }

  watch(
    [initialized, isAllowedUser],
    ([ready, allowed]) => {
      if (!ready) return;
      if (allowed) {
        refreshAnnouncements();
        return;
      }
      resetAnnouncements();
    },
    { immediate: true },
  );

  watch(
    [initialized, isAllowedUser, () => route.name, () => route.params.announcementId, announcements],
    async ([ready, allowed, routeName, rawAnnouncementId]) => {
      const announcementId = normalizeRouteParam(rawAnnouncementId);
      if (routeName !== 'announcement-detail') {
        announcementRequestId += 1;
        selectedAnnouncementId.value = '';
        fetchedAnnouncement.value = null;
        return;
      }
      if (!ready || !allowed) return;
      if (!announcementId) {
        const currentRequestId = ++announcementRequestId;
        await handleAnnouncementRouteError(currentRequestId);
        return;
      }

      selectedAnnouncementId.value = announcementId;
      if (announcements.value.some((announcement) => announcement.id === announcementId)) {
        fetchedAnnouncement.value = null;
        return;
      }
      if (fetchedAnnouncement.value?.id === announcementId) return;

      const currentRequestId = ++announcementRequestId;
      try {
        fetchedAnnouncement.value = await fetchAnnouncementRecordById(
          announcementId,
          user.value?.uid ?? null,
        );
      } catch (caught) {
        if (isAbortFailure(caught)) return;
        await handleAnnouncementRouteError(currentRequestId);
      }
    },
    { immediate: true },
  );

  return {
    announcements,
    sortOption,
    loading,
    loadingMore,
    refreshing,
    error,
    hasMore,
    loadMoreAnnouncements,
    refreshAnnouncements,
    selectedAnnouncementId,
    selectedAnnouncement,
    selectedAnnouncementInitialTab,
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
    closeAnnouncementDetails,
    copySelectedAnnouncementUrl,
    openEditor,
    closeEditor,
    handleSave,
    handleDelete,
    handleListDelete,
    handleCommentCountChanged,
    handleAnnouncementUnavailable,
    closeDeleteDialog,
    confirmDelete,
    handleToggleLike,
  };
}
