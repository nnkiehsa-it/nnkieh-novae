<template>
  <div class="min-h-0">
    <DetailRouteState
      :allowed="isAllowedUser"
      :loading="sessionLoading || loading"
      loading-label="正在載入設備"
      :problem="sessionLoadingHasProblem"
      :problem-title="sessionProblemTitle"
      :problem-description="sessionProblemDescription"
      :problem-retry-disabled="!sessionOnline"
      :error="error"
      error-title="設備讀取失敗"
      @retry-problem="reloadPage"
      @retry-error="retryFacility"
    >
      <FacilityDetailPagePanel
        v-if="facility"
        :affecting="affecting"
        :closed="closed"
        :facility="facility"
        :next-status-action-label="nextStatusActionLabel"
        :operation-time-items="operationTimeItems"
        :status-class="statusClass"
        :status-label="labels[facility.status]"
        @back="goBackToFacilities"
        @delete="openDeleteDialog"
        @manage-status="statusOpen = true"
        @share="copyFacilityUrl"
        @toggle-affected="handleToggleAffected"
      />
    </DetailRouteState>

    <FacilityStatusDialog
      v-if="facility"
      :open="statusOpen"
      :current-status="facility.status"
      :saving="statusSaving"
      :error="statusError"
      @close="closeStatusDialog"
      @submit="submitStatus"
    />

    <ConfirmDialog
      :open="deleteDialogOpen"
      title="確定要刪除這筆設備嗎？"
      message="刪除後這筆設備案件將無法復原。"
      confirm-label="確認刪除"
      :busy="deleting"
      @cancel="closeDeleteDialog"
      @confirm="confirmDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import FacilityDetailPagePanel from '@/components/FacilityDetailPagePanel.vue';
import FacilityStatusDialog from '@/components/FacilityStatusDialog.vue';
import DetailRouteState from '@/components/ui/DetailRouteState.vue';
import { useActionFeedback } from '@/composables/useActionFeedback';
import { useAuthenticatedDetailState } from '@/composables/useAuthenticatedDetailState';
import { useFacilityDetail } from '@/composables/useFacilityDetail';
import { useShareUrl } from '@/composables/useShareUrl';
import { useStatusStyling } from '@/composables/useStatusStyling';
import { formatDate } from '@/lib/format';
import { resetAppConnection } from '@/lib/reconnect';
import type { FacilityStatus, OperationTimeListItem } from '@/types';

const router = useRouter();
const {
  canLoad: canLoadFacility,
  isAllowedUser,
  sessionLoading,
  sessionLoadingHasProblem,
  sessionOnline,
  sessionProblemDescription,
  sessionProblemTitle,
} = useAuthenticatedDetailState();
const { copyShareUrl } = useShareUrl();
const { show, start } = useActionFeedback();

const {
  affecting,
  changeStatus,
  error,
  facility,
  load,
  loading,
  remove,
  toggleAffected,
} = useFacilityDetail(canLoadFacility);

const statusOpen = ref(false);
const statusSaving = ref(false);
const statusError = ref('');
const deleteDialogOpen = ref(false);
const deleting = ref(false);
const labels: Record<FacilityStatus, string> = {
  pending: '待受理',
  processing: '處理中',
  completed: '已完成',
  'unable-to-handle': '無法處理',
};
const closed = computed(() =>
  facility.value
    ? facility.value.status === 'completed' || facility.value.status === 'unable-to-handle'
    : false,
);
const nextStatusActionLabel = computed(() =>
  facility.value?.status === 'pending' ? '開始處理' : '完成／無法處理',
);
const operationTimeItems = computed<OperationTimeListItem[]>(() => {
  if (!facility.value) return [];
  const items: OperationTimeListItem[] = [];
  if (facility.value.created_at) {
    items.push({
      label: '待受理時間',
      shortLabel: '待受理',
      valueLabel: formatDate(facility.value.created_at),
    });
  }
  if (facility.value.started_at) {
    items.push({
      label: '開始處理時間',
      shortLabel: '處理',
      valueLabel: formatDate(facility.value.started_at),
    });
  }
  if (facility.value.closed_at) {
    const unable = facility.value.status === 'unable-to-handle';
    items.push({
      label: unable ? '無法處理時間' : '完成時間',
      shortLabel: unable ? '無法處理' : '完成',
      valueLabel: formatDate(facility.value.closed_at),
    });
  }
  return items;
});
const status = computed(() => facility.value?.status ?? 'pending');
const { statusClass } = useStatusStyling(status, 'dialog');

function goBackToFacilities() {
  void router.replace({ name: 'facilities' });
}

function copyFacilityUrl() {
  if (!facility.value) return;
  const href = router.resolve({
    name: 'facility-detail',
    params: { facilityId: facility.value.id },
  }).href;
  void copyShareUrl(new URL(href, window.location.origin).toString());
}

async function handleToggleAffected() {
  try {
    await toggleAffected();
  } catch (caught) {
    show(caught instanceof Error ? caught.message : '操作失敗，請稍後再試', 'error');
  }
}

function closeStatusDialog() {
  if (!statusSaving.value) {
    statusOpen.value = false;
    statusError.value = '';
  }
}

async function submitStatus(nextStatus: FacilityStatus, result: string) {
  if (statusSaving.value) return;
  statusSaving.value = true;
  statusError.value = '';
  const feedback = start('正在更新設備狀態');
  try {
    await changeStatus(nextStatus, result);
    statusOpen.value = false;
    feedback.succeed('設備狀態已更新');
  } catch (caught) {
    statusError.value = caught instanceof Error ? caught.message : '更新失敗，請稍後再試。';
    feedback.fail(statusError.value);
  } finally {
    statusSaving.value = false;
  }
}

function openDeleteDialog() {
  deleteDialogOpen.value = true;
}

function closeDeleteDialog() {
  if (!deleting.value) deleteDialogOpen.value = false;
}

async function confirmDelete() {
  if (!facility.value || deleting.value) return;
  deleting.value = true;
  const feedback = start('正在刪除設備案件');
  try {
    await remove();
    deleteDialogOpen.value = false;
    feedback.succeed('設備案件已刪除');
    goBackToFacilities();
  } catch (caught) {
    feedback.fail(caught instanceof Error ? caught.message : '設備刪除失敗');
  } finally {
    deleting.value = false;
  }
}

async function retryFacility() {
  await resetAppConnection();
  await load();
}

async function reloadPage() {
  await resetAppConnection();
  window.location.reload();
}
</script>
