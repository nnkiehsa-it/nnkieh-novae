<template>
  <ContentCardCollection
    :empty="facilities.length === 0"
    empty-label="facility.noFacilityReportsYet"
    list-label="facility.facilityList"
    :loading="loading"
  >
    <template #loading>
      <ContentCardSkeleton
        :action-shapes="['pill']"
        :count="loadingCount"
        loading-label="facility.loadingFacility"
        supplement="summary"
      />
    </template>

    <AnimatePresence mode="popLayout" :initial="false">
      <m.div
        v-for="facility in facilities"
        :key="facility.id"
        :data-content-id="facility.id"
        layout
        :initial="{ opacity: 0, y: 16, scale: 0.985 }"
        :animate="{ opacity: 1, y: 0, scale: 1 }"
        :exit="{ opacity: 0, y: -10, scale: 0.985 }"
        :transition="listMotionTransition"
      >
        <FacilityTableRow
          :facility="facility"
          :highlight-query="highlightQuery"
          :affecting="affectingFacilityId === facility.id"
          @open-details="emit('open-details', $event)"
          @toggle-affected="emit('toggle-affected', $event)"
        />
      </m.div>
    </AnimatePresence>
  </ContentCardCollection>
</template>

<script setup lang="ts">
import FacilityTableRow from '@/components/FacilityTableRow.vue';
import ContentCardCollection from '@/components/ui/organisms/ContentCardCollection.vue';
import ContentCardSkeleton from '@/components/ui/organisms/ContentCardSkeleton.vue';
import { AnimatePresence, m } from 'motion-v';
import type { FacilitySummary } from '@/types';
import { MOTION_SMOOTH_SPRING, MOTION_SMOOTH_TWEEN } from '@/lib/ui-motion';

withDefaults(defineProps<{
  affectingFacilityId?: string;
  facilities: FacilitySummary[];
  loading: boolean;
  loadingCount?: number;
  highlightQuery?: string;
}>(), {
  affectingFacilityId: '',
  highlightQuery: '',
  loadingCount: 2,
});
const emit = defineEmits<{
  'open-details': [facility: FacilitySummary];
  'toggle-affected': [facility: FacilitySummary];
}>();

const listMotionTransition = {
  layout: MOTION_SMOOTH_SPRING,
  opacity: MOTION_SMOOTH_TWEEN,
  scale: MOTION_SMOOTH_TWEEN,
  y: MOTION_SMOOTH_TWEEN,
};
</script>
