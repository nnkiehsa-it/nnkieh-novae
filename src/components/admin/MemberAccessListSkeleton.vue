<template>
  <SurfacePanel variant="list" aria-busy="true" :aria-label="loadingLabel">
    <ListSurfaceRow
      v-for="index in count"
      :key="index"
      as="div"
      class="skeleton-enter flex flex-wrap items-center gap-3"
      :style="{ '--skeleton-enter-index': index - 1 }"
    >
      <SkeletonBlock class="h-10 w-10 shrink-0 rounded-full" />
      <div class="min-w-0 flex-1 space-y-2">
        <SkeletonBlock class="block h-4 w-28 rounded" />
        <SkeletonBlock class="block h-3 w-40 rounded" />
      </div>
      <SkeletonBlock class="h-9 w-20 rounded-full" />
    </ListSurfaceRow>
  </SurfacePanel>
</template>

<script setup lang="ts">
import SkeletonBlock from '@/components/ui/atoms/SkeletonBlock.vue';
import ListSurfaceRow from '@/components/ui/molecules/ListSurfaceRow.vue';
import SurfacePanel from '@/components/ui/molecules/SurfacePanel.vue';

withDefaults(defineProps<{
  count?: number;
  loadingLabel: string;
}>(), {
  count: 1,
});
</script>
