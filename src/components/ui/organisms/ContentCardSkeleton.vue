<template>
  <div class="issue-card-grid" :aria-label="t(loadingLabel)" aria-busy="true">
    <SurfacePanel
      v-for="index in count"
      :key="index"
      as="article"
      class="issue-card"
    >
      <div
        class="skeleton-card"
        :style="{ '--skeleton-enter-index': index - 1 }"
      >
        <header class="flex min-w-0 items-center gap-2">
          <SkeletonBlock class="h-5 w-14 shrink-0 rounded-full" />
          <SkeletonBlock class="ml-auto h-3 w-20 rounded" />
        </header>

        <div class="mt-3 flex min-w-0 items-center gap-2.5">
          <SkeletonBlock
            v-if="showAuthor"
            class="h-8 w-8 shrink-0 rounded-full"
          />
          <div class="min-w-0 flex-1 space-y-2">
            <SkeletonBlock class="block h-4 w-4/5 rounded" />
            <SkeletonBlock v-if="showAuthor" class="block h-3 w-2/5 rounded" />
          </div>
        </div>

        <SurfacePanel
          v-if="supplement !== 'none'"
          variant="inset"
          class="mt-4 px-3 py-2.5"
        >
          <template v-if="supplement === 'progress'">
            <div class="flex items-center justify-between gap-3">
              <SkeletonBlock class="h-3 w-24 rounded" />
              <SkeletonBlock class="h-3 w-14 rounded" />
            </div>
            <SkeletonBlock class="mt-2 block h-1.5 w-full rounded-full" />
          </template>
          <div v-else class="flex items-center justify-between gap-3">
            <SkeletonBlock class="h-3 w-2/5 rounded" />
            <SkeletonBlock class="h-3 w-20 rounded" />
          </div>
        </SurfacePanel>

        <footer
          v-if="actionShapes.length"
          class="mt-3 flex items-center justify-end gap-1.5"
        >
          <SkeletonBlock
            v-for="(shape, actionIndex) in actionShapes"
            :key="`${shape}-${actionIndex}`"
            class="h-8 rounded-full"
            :class="shape === 'icon' ? 'w-8' : 'w-12'"
          />
        </footer>
      </div>
    </SurfacePanel>
  </div>
</template>

<script setup lang="ts">
import SurfacePanel from '@/components/ui/molecules/SurfacePanel.vue';
import SkeletonBlock from '@/components/ui/atoms/SkeletonBlock.vue';
import { useI18n } from '@/i18n';

type SkeletonActionShape = 'icon' | 'pill';
type SkeletonSupplement = 'none' | 'progress' | 'summary';

withDefaults(
  defineProps<{
    actionShapes?: readonly SkeletonActionShape[];
    count?: number;
    loadingLabel: string;
    showAuthor?: boolean;
    supplement?: SkeletonSupplement;
  }>(),
  {
    actionShapes: () => [],
    count: 2,
    showAuthor: true,
    supplement: 'none',
  },
);

const { t } = useI18n();
</script>
