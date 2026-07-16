<template>
  <div class="issue-table overflow-visible" role="list" aria-label="設備列表">
    <SkeletonTable v-if="loading && facilities.length === 0" :show-author="true" :is-admin="false" />
    <div v-else-if="facilities.length === 0" class="px-4 py-12 text-center text-sm text-ink-500 dark:text-ink-400">沒有符合的設備。</div>
    <div v-else class="issue-card-grid" role="presentation">
      <FacilityTableRow
        v-for="facility in facilities"
        :key="facility.id"
        :facility="facility"
        :highlight-query="highlightQuery"
        :affecting="affectingFacilityId === facility.id"
        @open-details="emit('open-details', $event)"
        @toggle-affected="emit('toggle-affected', $event)"
        @manage-status="emit('manage-status', $event)"
        @delete="emit('delete', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import FacilityTableRow from '@/components/FacilityTableRow.vue';
import SkeletonTable from '@/components/ui/SkeletonTable.vue';
import type { FacilitySummary } from '@/types';

withDefaults(defineProps<{
  affectingFacilityId?: string;
  facilities: FacilitySummary[];
  loading: boolean;
  highlightQuery?: string;
}>(), {
  affectingFacilityId: '',
  highlightQuery: '',
});
const emit = defineEmits<{
  'open-details': [facility: FacilitySummary];
  'toggle-affected': [facility: FacilitySummary];
  'manage-status': [facility: FacilitySummary];
  delete: [facility: FacilitySummary];
}>();
</script>
