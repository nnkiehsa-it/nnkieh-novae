<template>
  <div
    class="mt-4 shrink-0 border-t border-ink-100 pb-1 dark:border-ink-800"
    :class="compact ? 'space-y-3 px-1 pt-3' : 'space-y-3 pt-3'"
  >
    <div class="flex flex-wrap items-center gap-2">
      <DetailActionButton
        :active="facility.currentUserAffected"
        :disabled="facility.isOwnFacility || closed || affecting"
        :label="`${facility.affected_count} 人遇到`"
        :compact="compact"
        :title="facility.isOwnFacility ? '作者已自動計入' : '我也遇到'"
        :aria-label="facility.isOwnFacility ? '作者已自動計入遇到人數' : '切換我也遇到'"
        @click="emit('toggleAffected')"
      >
        <AppIcon name="hand" />
      </DetailActionButton>

      <DetailActionButton
        label="分享"
        :compact="compact"
        title="複製分享連結"
        aria-label="複製分享連結"
        @click="emit('share')"
      >
        <AppIcon name="share" />
      </DetailActionButton>

      <DetailActionButton
        v-if="facility.canManageFacility && !closed"
        :label="nextStatusActionLabel"
        :compact="compact"
        :title="nextStatusActionLabel"
        :aria-label="nextStatusActionLabel"
        @click="emit('manageStatus')"
      >
        <AppIcon name="edit" />
      </DetailActionButton>

      <DetailActionButton
        v-if="facility.canManageFacility || (facility.isOwnFacility && facility.status === 'pending')"
        danger
        label="刪除"
        :compact="compact"
        title="刪除設備案件"
        aria-label="刪除設備案件"
        @click="emit('delete')"
      >
        <AppIcon name="trash" />
      </DetailActionButton>
    </div>

    <OperationTimeList :items="operationTimeItems" :compact="compact" />
  </div>
</template>

<script setup lang="ts">
import DetailActionButton from '@/components/ui/DetailActionButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import OperationTimeList from '@/components/ui/OperationTimeList.vue';
import type { FacilityRecord, OperationTimeListItem } from '@/types';

defineProps<{
  affecting: boolean;
  closed: boolean;
  compact?: boolean;
  facility: FacilityRecord;
  nextStatusActionLabel: string;
  operationTimeItems: OperationTimeListItem[];
}>();

const emit = defineEmits<{
  delete: [];
  manageStatus: [];
  share: [];
  toggleAffected: [];
}>();
</script>
