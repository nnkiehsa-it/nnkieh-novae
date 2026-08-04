<template>
  <ol class="grid gap-2 text-xs text-ink-500 dark:text-ink-400 md:flex md:gap-0">
    <li
      v-for="(item, index) in items"
      :key="item.label"
      class="relative grid min-w-0 grid-cols-[0.75rem_minmax(0,1fr)] gap-2 pb-2 last:pb-0 md:flex md:flex-1 md:flex-col md:gap-1.5 md:pb-0 md:pr-3"
    >
      <span
        v-if="index < items.length - 1"
        class="absolute bottom-[-0.25rem] left-[0.34375rem] top-3 w-px bg-ink-300/80 dark:bg-ink-700 md:bottom-auto md:left-1.5 md:right-0 md:top-1.5 md:h-px md:w-auto"
        aria-hidden="true"
      ></span>
      <span class="relative z-10 mt-1 h-3 w-3 rounded-full bg-ink-700 ring-2 ring-[rgb(var(--color-secondary-container))] dark:bg-ink-200" aria-hidden="true"></span>
      <span class="min-w-0 md:pr-2">
        <span class="block font-semibold text-ink-500 dark:text-ink-400">
          {{ t(compact ? item.shortLabel : item.label) }}
        </span>
        <span class="mt-0.5 block font-medium tabular-nums text-ink-800 dark:text-ink-200">
          {{ t(item.valueLabel) }}
        </span>
      </span>
    </li>
  </ol>
</template>

<script setup lang="ts">
import type { OperationTimeListItem } from '@/types';
import { useI18n } from '@/i18n';

const { t } = useI18n();

withDefaults(defineProps<{
  compact?: boolean;
  items: OperationTimeListItem[];
}>(), {
  compact: false,
});
</script>
