<template>
  <header class="flex items-start gap-3">
    <span
      class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-950 text-xs font-bold text-white dark:bg-ink-50 dark:text-ink-950"
      aria-hidden="true"
    >
      {{ step }}
    </span>
    <div class="min-w-0 flex-1">
      <h3 :id="titleId" class="text-sm font-bold text-ink-950 dark:text-ink-50">{{ title }}</h3>
      <p v-if="description" class="mt-1 text-xs leading-5 text-ink-500 dark:text-ink-400">{{ description }}</p>
    </div>
  </header>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  description?: string;
  step: number;
  title: string;
  titleId?: string;
}>(), {
  description: '',
  titleId: undefined,
});
</script>
