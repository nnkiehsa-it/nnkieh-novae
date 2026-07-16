<template>
  <DetailPageShell
    back-label="返回設備列表"
    details-label="設備內容"
    :show-comments="false"
    :show-mobile-back-button="false"
    @back="emit('back')"
  >
    <template #header>
      <span class="tag border-ink-200 bg-ink-100/50 dark:border-ink-800 dark:bg-ink-950/50">設備</span>
      <span class="tag font-semibold shadow-note" :class="statusClass">{{ statusLabel }}</span>
    </template>

    <template #details="{ compact, scrollContent }">
      <ContentDetailBody
        :author-name="facility.author_name"
        :author-photo-url="facility.author_photo_url"
        :author-secondary="facility.location"
        :author-uid="facility.author_uid"
        :compact="compact"
        :content="facility.content"
        :notice-content="facility.result_content"
        :notice-fallback-alt="`${facility.title} 的設備處理結果圖片`"
        notice-title="處理結果"
        notice-markdown
        :scroll-content="scrollContent"
        :title="facility.title"
      />
    </template>

    <template #actions="{ compact }">
      <FacilityDetailActions
        :affecting="affecting"
        :closed="closed"
        :compact="compact"
        :facility="facility"
        :next-status-action-label="nextStatusActionLabel"
        :operation-time-items="operationTimeItems"
        @delete="emit('delete')"
        @manage-status="emit('manageStatus')"
        @share="emit('share')"
        @toggle-affected="emit('toggleAffected')"
      />
    </template>
  </DetailPageShell>
</template>

<script setup lang="ts">
import FacilityDetailActions from '@/components/FacilityDetailActions.vue';
import ContentDetailBody from '@/components/ContentDetailBody.vue';
import DetailPageShell from '@/components/ui/DetailPageShell.vue';
import type { FacilityRecord, OperationTimeListItem } from '@/types';

defineProps<{
  affecting: boolean;
  closed: boolean;
  facility: FacilityRecord;
  nextStatusActionLabel: string;
  operationTimeItems: OperationTimeListItem[];
  statusClass: string;
  statusLabel: string;
}>();

const emit = defineEmits<{
  back: [];
  delete: [];
  manageStatus: [];
  share: [];
  toggleAffected: [];
}>();
</script>
