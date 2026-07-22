<template>
  <RoutePageFrame as="section" bleed layout="fill" class="entry-composer-page">
    <FacilityComposer
      :category-id="categoryId"
      @close="returnToList"
      @submitted="openSubmittedFacility"
    />
  </RoutePageFrame>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import FacilityComposer from '@/components/FacilityComposer.vue';
import RoutePageFrame from '@/components/ui/organisms/RoutePageFrame.vue';
import { findFacilityCategory, getDefaultFacilityCategoryId } from '@/composables/useCategories';
import type { FacilityRecord } from '@/types';

const route = useRoute();
const router = useRouter();
const categoryId = computed(() => {
  const value = Array.isArray(route.query.category) ? route.query.category[0] : route.query.category;
  return typeof value === 'string' && Boolean(findFacilityCategory(value))
    ? value
    : getDefaultFacilityCategoryId();
});

function returnToList() {
  void router.replace({ name: 'facilities', query: { category: categoryId.value } });
}

function openSubmittedFacility(facility: FacilityRecord) {
  void router.replace({ name: 'facility-detail', params: { facilityId: facility.id } });
}
</script>
